const express = require("express");
const router = express.Router();
const PuppeteerRestLib = require("../libs/puppeteer-rest-lib.js");
const SitesLib = require("../libs/sites-lib");
const auth = require("../libs/auth");
const asyncLib = require("async");
const moment = require("moment");
const config = require("config");
const GoogleNLP = require("google-nlp");
const nlp = new GoogleNLP(config.google.apiKey);

const puppeteer = new PuppeteerRestLib({
	username: config.puppeteerRest.username,
	password: config.puppeteerRest.password
});

var setup = (req, res, next) => {
	res.locals.title = "MavNews";
	res.locals.siteName = "MavNews";
	res.locals.moment = moment;
	next();
};

router.use(setup);

router.get("/login", (req, res) => {
	res.render("login");
});

router.post("/login", auth.login, (req, res) => res.redirect("/"));

router.get("/logout", auth.logout, (req, res, next) => res.redirect("/login"));

var sites = (req, res, next) => {
	req.apihelper.get("site", { "sort[name]": 1 }).then(result => {
		sites = result.data;
		var queue = sites.map(site => {
			return cb =>
				puppeteer
					.open(site.url, site.reload)
					.then(result => {
						site._id = result._id;
						site.date_created = result.date_created;
						site.date_updated = result.date_updated;
						site.fromNow = moment(result.date_updated).fromNow();
						cb(null, site);
					})
					.catch(err => {
						cb(err);
					});
		});
		asyncLib.series(queue, (error, result) => {
			if (error) {
				console.trace(error);
				res.render("error", { error });
			}
			req.sites = result;
			next();
		});
	});
};

var getSiteData = site => {
	let queue = [];
	site.selectors.forEach((selector, index) => {
		for (i in selector) {
			let key = i;
			let type = selector[key].type;
			if (type === "text") {
				queue.push(cb => {
					return puppeteer
						.text(site._id, selector[key].selector)
						.then(val => {
							cb(null, { index, key, val });
						})
						.catch(err => cb(err));
				});
			} else if (type === "attr") {
				queue.push(cb => {
					return puppeteer
						.attr(
							site._id,
							selector[key].selector,
							selector[key].attr
						)
						.then(val => {
							cb(null, { index, key, val });
						})
						.catch(err => cb(err));
				});
			}
		}
	});
	return new Promise((resolve, reject) => {
		asyncLib.series(queue, (err, result) => {
			if (err) {
				console.trace(err);
				return resolve([]);
			}
			var articles = [];
			result.forEach(item => {
				if (!articles[item.index]) articles[item.index] = {};
				articles[item.index][item.key] = item.val.text;
			});

			return resolve(articles);
		});
	});
};

var extractSites = (req, res, next) => {
	let siteQueue = [];
	req.sites.forEach(site => {
		siteQueue.push(cb => {
			return getSiteData(site)
				.then(articles => {
					return cb(null, { site, articles });
				})
				.catch(err => {
					return cb(err);
				});
		});
	});
	asyncLib.series(siteQueue, (err, result) => {
		console.log({ err, result }, result[0]);
		res.locals.sites = result;
		next();
	});
};

var fixRelativeUrls = (req, res, next) => {
	var r = new RegExp("^(?:[a-z]+:)?//", "i");
	res.locals.sites.forEach(site => {
		site.articles.forEach(article => {
			if (!r.test(article.href)) {
				article.href = site.site.url + article.href;
			}
		});
	});
	next();
};

var getNlp = (req, res, next) => {
	var queue = [];
	var entityList = [];
	res.locals.sites.forEach(site => {
		site.articles.forEach(article => {
			queue.push(cb => {
				if (!article.headline) return cb();
				return nlp
					.analyzeEntities(article.headline)
					.then(result => {
						console.log(result);
						article.entities = result.entities;
						article.entities.forEach(entity => {
							entityListItem = entityList.find(
								el => entity.name == el.name
							);
							if (!entityListItem) {
								entityList.push({
									name: entity.name,
									count: 1,
									salience_total: entity.salience
								});
							} else {
								entityListItem.count++;
								entityListItem.salience_total +=
									entity.salience;
							}
						});
						cb();
					})
					.catch(err => {
						console.error(err);
						cb();
					});
			});
		});
	});
	asyncLib.parallel(queue, (err, result) => {
		entityList.sort((a, b) => b.count - a.count);
		res.locals.entityListCount = entityList.concat();
		entityList.sort((a, b) => b.salience_total - a.salience_total);
		res.locals.entityListSalience = entityList.concat();
		console.log(entityList);
		next();
	});
};

var getArticles = (req, res, next) => {
	req.apihelper
		.get("article", { limit: 30, "sort[date]": -1 })
		.then(result => {
			res.locals.articles = result.data;
			next();
		})
		.catch(err => {
			res.send(err);
		});
};

/* GET home page. */
router.get(
	"/",
	auth.restricted,
	sites,
	extractSites,
	fixRelativeUrls,
	getNlp,
	getArticles,
	(req, res, next) => {
		res.render("index", { title: "MavNews", pg: "home" });
	}
);

router.get("/article/:article_id", auth.restricted, (req, res, next) => {
	req.apihelper.getOne("article", req.params.article_id).then(article => {
		if (article.provider !== "AFP") {
			article.body = article.body.replace(/\n/g, "<br>\n");
		}
		res.render("article", { article });
	});
});

router.get("/articles/:limit", auth.restricted, (req, res, next) => {
	req.apihelper
		.get("article", { limit: req.params.limit, "sort[date]": -1 })
		.then(result => {
			articles = result.data;
			res.render("articles", { articles, pg: "articles" });
		});
});

router.post("/", (req, res) => {
	res.redirect("/");
});

router.get("/sites", auth.restricted, sites, (req, res, next) => {
	res.send(req.sites);
});

router.get("/sites/trim", auth.restricted, sites, (req, res, next) => {
	res.send(
		req.sites.map(site => {
			return { _id: site._id, name: site.name, url: site.url };
		})
	);
});

router.get("/site/:site_id", auth.restricted, sites, (req, res, next) => {
	let site = sites.find(site => site._id === req.params.site_id);
	getSiteData(site).then(articles => {
		res.send({ site, articles });
	});
});

router.get(
	"/dynamic",
	auth.restricted,
	sites,
	extractSites,
	(req, res, next) => {
		res.render("dynamic");
	}
);

module.exports = router;
