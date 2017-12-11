var rest = require("restler-bluebird");
var config = require("Config");

class PuppeteerRestLib {
	constructor(opts) {
		this.username = opts.username;
		this.password = opts.password;
	}

	open(url, reload) {
		return rest.post(`${ config.puppeteerRest.url }/open`, { username: this.username, password: this.password, data: { url, reload }})
	}

	text(id, selector) {
		return rest.post(`${ config.puppeteerRest.url }/page/${ id }/text`, { username: this.username, password: this.password, data: { selector }})
	}

	attr(id, selector, attr) {
		return rest.post(`${ config.puppeteerRest.url }/page/${ id }/attr`, { username: this.username, password: this.password, data: { selector, attr }})
	}
}

module.exports = PuppeteerRestLib;