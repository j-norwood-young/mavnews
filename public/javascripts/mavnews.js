$(function() {
	var article_template = _.template($("#article_template").html());
	$.get("/sites").then(function(result) {
		sites = result;
		sites.forEach(function(site) {
			$.get("/site/" + site._id).then(function(result) {
				var siteEl = $("[data-site_id='" + site._id + "']");
				siteEl.find(".fromNow").html(result.site.fromNow);
				siteEl.find(".articles").empty();
				result.articles.forEach(function(article) {
					// console.log(article);
					// console.log(article_template({ article: article }));
					siteEl
						.find(".articles")
						.append(article_template({ article: article }));
				});
			});
		});
	});
});
