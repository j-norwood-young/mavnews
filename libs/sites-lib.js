const fs = require("fs");
const path = require("path");

class sitesLib {
	constructor() {
		let files = fs.readdirSync("./sites");
		this.sites = [];
		files.forEach(file => {
			this.sites.push(require(path.join("../sites", file)));
		})
	}
	
}

module.exports = sitesLib;