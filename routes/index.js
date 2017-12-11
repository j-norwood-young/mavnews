var express = require('express');
var router = express.Router();
var PuppeteerRestLib = require("../libs/puppeteer-rest-lib.js");
var SitesLib = require("../libs/sites-lib");
var async = require("async");
var moment = require("moment");
const config = require("config");
const GoogleNLP = require('google-nlp')
const nlp = new GoogleNLP(config.google.apiKey);


var setup = (req, res, next) => {
	res.locals.title = "MavNews";
	res.locals.siteName = "MavNews";
	next();
}

router.use(setup);

var login = (req, res, next) => {
	if (req.body) {
		if (req.body.username) {
			req.session.username = req.body.username;
			req.session.password = req.body.password;
		}
	}
	if (!req.session.username || !req.session.password)
		return res.render("login");
	next();
}

// router.post("/", (req, res) => {
// 	res.redirect("/")
// })

// router.use(login);

router.get("/logout", (req, res) => {
	req.session.username = null;
	req.session.password = null;
	res.redirect("/");
});

var puppeteer = (req, res, next) => {
	req.puppeteer = new PuppeteerRestLib({ username: req.session.username, password: req.session.password });
	next();
}

router.use(puppeteer);

var sites = (req, res, next) => {
	var sites = new SitesLib();
	var queue = sites.sites.map(site => {
		return cb => req.puppeteer.open(site.url, site.reload)
		.then(result => {
			site._id = result._id;
			site.date_created = result.date_created;
			site.date_updated = result.date_updated;
			site.fromNow = moment(result.date_updated).fromNow();
			cb(null, site);
		})
		.catch(err => {
			cb(err);
		})
	})
	async.series(queue, (error, result) => {
		if (error) {
			console.trace(error)
			res.render("error", { error })
		}
		req.sites = result;
		next();
	})
}

var extract = (req, res, next) => {
	var getSiteData = (site) => {
		let queue = [];
		site.selectors.forEach((selector, index) => {
			for (i in selector) {
				let key = i;
				let type = selector[key].type;
				if (type === "text") {
					queue.push((cb) => {
						return req.puppeteer.text(site._id, selector[key].selector)
						.then(val => {
							cb(null, { index, key, val });
						})
						.catch(err => cb(err));
					});
				} else if (type === "attr") {
					queue.push((cb) => {
						return req.puppeteer.attr(site._id, selector[key].selector, selector[key].attr)
						.then(val => {
							cb(null, { index, key, val });
						})
						.catch(err => cb(err));
					});
				}
			}
		})
		return new Promise((resolve, reject) => {
			async.series(queue, (err, result) => {
				if (err) {
					console.trace(err);
					return resolve([]);
				}
				var articles = [];
				result.forEach(item => {
					if (!articles[item.index])
						articles[item.index] = {};
					articles[item.index][item.key] = item.val.text;
				});

				return resolve(articles);
			});	
		})
	}
	let siteQueue = [];
	req.sites.forEach(site => {
		siteQueue.push(cb => {

			return getSiteData(site)
			.then(articles => {
				return cb(null, { site, articles})
			})
			.catch(err => {
				return cb(err);
			})
		})
	})
	async.series(siteQueue, (err, result) => {
		console.log({err , result}, result[0]);
		res.locals.sites = result;
		next();
	})
}

var fixRelativeUrls = (req, res, next) => {
	var r = new RegExp('^(?:[a-z]+:)?//', 'i');
	res.locals.sites.forEach(site => {
		site.articles.forEach(article => {
			if (!r.test(article.href)) {
				article.href = site.site.url + article.href;
			}
		})
	})
	next();
}

getNlp = (req, res, next) => {
	var queue = [];
	var entityList = [];
	res.locals.sites.forEach(site => {
		site.articles.forEach(article => {
			queue.push((cb) => {
				if (!article.headline)
					return cb();
				return nlp.analyzeEntities(article.headline)
				.then(result => {
					console.log(result);
					article.entities = result.entities;
					article.entities.forEach(entity => {
						entityListItem = entityList.find(el => entity.name == el.name);
						if (!entityListItem) {
							entityList.push({ name: entity.name, count: 1, salience_total: entity.salience });
						} else {
							entityListItem.count++;
							entityListItem.salience_total += entity.salience;
						}
					})
					cb();
				})
				.catch(err => {
					console.error(err);
					cb();
				})
			});
		});
	});
	async.parallel(queue, (err, result) => {
		entityList.sort((a, b) => (b.count - a.count));
		res.locals.entityListCount = entityList.concat();
		entityList.sort((a, b) => (b.salience_total - a.salience_total));
		res.locals.entityListSalience = entityList.concat();
		console.log(entityList)
		next();
	})
}

/* GET home page. */
router.get('/', sites, extract, fixRelativeUrls, getNlp, function(req, res, next) {
	res.render('index', { title: 'MavNews' });
});

module.exports = router;
