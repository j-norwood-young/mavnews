const config = require("config");
const GoogleNLP = require('google-nlp')

class NLP {
	constructor() {
		this.nlp = new GoogleNLP(config.google.apiKey)
	}

	entities(text) {
		return this.nlp.analyseEntities(text)
	}

	sentiment(text) {
		return this.nlp.analyseSentiment(text)
	}

	syntax(text) {
		return this.nlp.analyseSyntax(text)
	}

	annotate(text) {
		return this.nlp.annotateText( text, { syntax: true, sentiment: true, entities: true } )
	}
}

module.export = NLP;