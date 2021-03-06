
var alphanumeric = /[a-zA-Z0-9]/i;

/**
 * LastLetterExtractor - extracts the last letter if it is not a letter (which may indicate a question, etc.).
 */
module.exports = function(sample, features) {
	if (!sample || sample.length==0) return features;
	if (!features) features = {};
	var lastLetter = sample[sample.length-1];
	if (!alphanumeric.test(lastLetter)) {
		var feature = lastLetter+" [end]";
		features[feature]=1;
		//console.dir(features);
	}
	return features;
}
