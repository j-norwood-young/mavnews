const APIHelper = require("./apihelper");
const rest = require("restler-bluebird");
const config = require("config");

var auth = {
	restricted: (req, res, next) => {
		console.log(req.session);
		var apikey = req.session.apikey || null;
		var user = req.session.user || null;
		if (!apikey || !user) return res.redirect("/login");
		req.apihelper = new APIHelper({ apikey });
		res.locals.user = user;
		req.apihelper
			.getOne("user", user._id)
			.then(result => {
				next();
			})
			.catch(err => {
				console.error(err);
				return res.redirect("/login");
			});
	},
	login: (req, res, next) => {
		console.log("Logging in");
		rest
			.post(config.api.root + "/login", {
				data: { email: req.body.email, password: req.body.password }
			})
			.then(function(data) {
				req.session.apikey = data.apikey;
				req.session.user_id = data.user_id;
				return rest.get(
					config.api.url +
						"/user/" +
						data.user_id +
						"?autopopulate=true&apikey=" +
						data.apikey
				);
			})
			.then(
				function(user) {
					req.session.user = user;
					req.session.apikey = req.session.apikey;
					next();
				},
				function(err) {
					console.trace(err);
					res.redirect("/login");
				}
			)
			.catch(err => {
				console.trace(err);
				res.send(err);
			});
	},
	logout: (req, res, next) => {
		req.session.user = null;
		req.session.apikey = null;
		req.apihelper = null;
		next();
	}
};

module.exports = auth;
