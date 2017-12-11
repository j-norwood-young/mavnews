var rest = require("restler-bluebird");
var config = require("Config");

class PuppeteerRestLib {
	constructor(opts) {
	}

	open(url, reload) {
		return rest.post(`${ config.puppeteerRest.url }/open`, { username: config.puppeteerRest.username, password: config.puppeteerRest.password, data: { url, reload }})
	}

	text(id, selector) {
		return rest.post(`${ config.puppeteerRest.url }/page/${ id }/text`, { username: config.puppeteerRest.username, password: config.puppeteerRest.password, data: { selector }})
	}

	attr(id, selector, attr) {
		return rest.post(`${ config.puppeteerRest.url }/page/${ id }/attr`, { username: config.puppeteerRest.username, password: config.puppeteerRest.password, data: { selector, attr }})
	}
}

module.exports = PuppeteerRestLib;