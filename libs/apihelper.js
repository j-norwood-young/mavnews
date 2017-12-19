var config = require("config");
var rest = require("restler-bluebird");

var APIHelper = function(opts) {
	var self = this;
	apikey = null;
	self.api = config.api.url;
	self.api_root = config.api.root;

	self.config = opts => {
		var self = this;
		console.log("Opts", opts);
		for (var opt in opts) {
			self[opt] = opts[opt];
		}
	};

	self.config(opts);

	var _configParams = opts => {
		opts = opts || {};
		opts.apikey = self.apikey;
		var parts = [];
		for (var opt in opts) {
			if (Array.isArray(opts[opt])) {
				opts[opt].forEach(val => {
					parts.push(opt + "=" + val);
				});
			} else {
				parts.push(opt + "=" + opts[opt]);
			}
		}
		return parts.join("&");
	};

	self.setup = (req, res, next) => {
		req.apihelper = new APIHelper({ apikey: req.session.apikey });
		next();
	};

	self.url = (type, opts) => {
		return self.api + "/" + type + "?" + _configParams(opts);
	};

	self.getOne = (type, id, opts) => {
		console.time("getOne." + type);
		var url = self.api + "/" + type + "/" + id + "?" + _configParams(opts);
		return rest.get(url).then(function(result) {
			console.timeEnd("getOne." + type);
			return result;
		});
	};

	self.get = (type, opts) => {
		console.time("get." + type);
		var url = self.url(type, opts);
		console.log(url);
		return rest.get(url).then(function(result) {
			console.timeEnd("get." + type);
			return result;
		});
	};

	self.post = (type, opts) => {
		var url = self.api + "/" + type + "?apikey=" + self.apikey;
		console.log("POSTing to ", url, opts);
		return rest.post(url, { data: opts });
	};

	self.put = (type, id, opts) => {
		var url = self.api + "/" + type + "/" + id + "?apikey=" + self.apikey;
		return rest.put(url, { data: opts });
	};

	self.postput = (type, key, opts) => {
		// Post if we find key=id, else put
		var self = this;
		var obj = {};
		obj["filter[" + key + "]"] = opts[key];
		return self.get(type, obj).then(function(result) {
			if (result.count) {
				var id = result.data[0]._id;
				return self.put(type, id, opts);
			} else {
				return self.post(type, opts);
			}
		});
	};

	self.del = (type, id) => {
		var url = self.api + "/" + type + "/" + id + "?apikey=" + self.apikey;
		return rest.del(url);
	};

	self.delAll = (type, key, id) => {
		var self = this;
		var obj = {};
		obj["filter[" + key + "]"] = id;
		return self.get(type, obj).then(function(result) {
			var queue = [];
			if (result.count === 0) return true;
			result.data.forEach(function(row) {
				console.log("Found", row);
				queue.push(function() {
					console.log("Deleting id", row._id);
					return self.del(type, row._id);
				});
			});
			return queue.reduce(function(soFar, f) {
				return soFar.then(f);
			}, Q());
		});
	};

	self.sync = (type, key, id, data) => {
		// Given the records filtered by key = id, we create, update or delete until we are in sync with data.
		var obj = {};
		obj["filter[" + key + "]"] = id;
		return self.get(type, obj).then(function(result) {
			var data_ids = data
				.filter(function(row) {
					return row._id;
				})
				.map(function(row) {
					return row._id;
				});
			var dest_ids = result.data.map(function(row) {
				return row._id;
			});
			// console.log("data_ids", data_ids);
			// console.log("dest_ids", dest_ids);
			var deletes =
				dest_ids.filter(function(n) {
					return data_ids.indexOf(n) == -1;
				}) || [];
			var moreinserts =
				data_ids.filter(function(n) {
					return dest_ids.indexOf(n) == -1;
				}) || [];
			var inserts = data.filter(function(row) {
				return moreinserts.indexOf(row._id) != -1 || !row._id;
			});
			var update_ids =
				dest_ids.filter(function(n) {
					return data_ids.indexOf(n) != -1;
				}) || [];
			var updates =
				data.filter(function(row) {
					return update_ids.indexOf(row._id) != -1;
				}) || [];
			var queue = [];
			inserts.forEach(function(insert_data) {
				queue.push(function() {
					console.log("Inserting");
					self.post(type, insert_data);
				});
			});
			updates.forEach(function(update_data) {
				queue.push(function() {
					console.log("Updating");
					self.put(type, update_data._id, update_data);
				});
			});
			deletes.forEach(function(delete_id) {
				queue.push(function() {
					console.log("Deleting");
					self.del(type, delete_id);
				});
			});
			return queue.reduce(function(soFar, f) {
				return soFar.then(f);
			}, Q());
		});
	};

	self.call = (type, cmd, data) => {
		//Call a function in the model
		var url =
			self.api_root +
			"/call/" +
			type +
			"/" +
			cmd +
			"?apikey=" +
			self.apikey;
		console.log("CALLing  ", url, data);
		return rest.post(url, { data: data });
	};

	self.groups_put = (user_id, groups) => {
		var url =
			self.api_root + "/groups/" + user_id + "?apikey=" + self.apikey;
		return rest.put(url, { data: { group: groups } });
	};

	self.groups_del = (user_id, groups) => {
		var url =
			self.api_root + "/groups/" + user_id + "?apikey=" + self.apikey;
		return rest.del(url, { data: { group: groups } });
	};

	self.groups_post = (user_id, groups) => {
		var url =
			self.api_root + "/groups/" + user_id + "?apikey=" + self.apikey;
		return rest.post(url, { data: { group: groups } });
	};

	self.getLocations = (req, res, next) => {
		self.get("location").then(
			function(locations) {
				res.locals.locations = locations.data;
				return next();
			},
			function(err) {
				return res.send(err);
			}
		);
	};

	self.getMemberships = (req, res, next) => {
		self.get("membership").then(
			function(result) {
				res.locals.memberships = result.data;
				return next();
			},
			function(err) {
				return res.send(err);
			}
		);
	};

	self.getMembers = (req, res, next) => {
		self.get("user", { "filter[status]": "active" }).then(
			function(result) {
				res.locals.members = result.data;
				return next();
			},
			function(err) {
				return res.send(err);
			}
		);
	};

	self.getOrganisations = (req, res, next) => {
		self.get("organisation", { "filter[status]": "active" }).then(
			function(result) {
				res.locals.organisations = result.data;
				return next();
			},
			function(err) {
				return res.send(err);
			}
		);
	};
};

module.exports = APIHelper;
