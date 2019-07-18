var embeddedRegexp = /^data:(.*?),(.*?)/;
var commentRegexp = /\/\*([\s\S]*?)\*\//g;
var urlsRegexp = /(?:@import\s+)?url\s*\(\s*(("(.*?)")|('(.*?)')|(.*?))\s*\)|(?:@import\s+)(("(.*?)")|('(.*?)')|(.*?))[\s;]/ig;

function isEmbedded (src) {
	return embeddedRegexp.test(src.trim());
}

function getUrls (text) {
	var urls = [];
	var urlMatch, url;

	text = text.replace(commentRegexp, '');

	while ((urlMatch = urlsRegexp.exec(text))) {
		// Match 3, 5, 6 group if '[@import] url(path)', match 9, 11, 12 group if '@import path'
		url = urlMatch[3] || urlMatch[5] || urlMatch[6] || urlMatch[9] || urlMatch[11] || urlMatch[12];

		if (url && !isEmbedded(url) && urls.indexOf(url) === -1) {
			urls.push(url);
		}
	}

	return urls;
}

module.exports = getUrls;
