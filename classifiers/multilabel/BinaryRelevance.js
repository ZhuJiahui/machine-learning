var hash = require("../../utils/hash");
var sprintf = require("sprintf").sprintf;
var _ = require("underscore")._;

/**
 * BinaryRelevance - Multi-label classifier, based on a collection of binary classifiers.  
 * 
 * @param opts
 *            binaryClassifierType (mandatory) - the type of the base binary classifier. 
 *            binaryClassifierOptions (optional) - options that will be sent to the binary classifier constructor.
 */
var BinaryRelevance = function(opts) {
	if (!('binaryClassifierType' in opts)) {
		console.dir(opts);
		throw new Error("opts must contain binaryClassifierType");
	}
	if (!opts.binaryClassifierType) {
		console.dir(opts);
		throw new Error("opts.binaryClassifierType is null");
	}
	this.binaryClassifierType = opts.binaryClassifierType;
	this.binaryClassifierOptions = opts.binaryClassifierOptions;
	this.mapClassnameToClassifier = {};
}

BinaryRelevance.prototype = {

	/**
	 * Tell the classifier that the given classes will be used for the following
	 * samples, so that it will know to add negative samples to classes that do
	 * not appear.
	 * 
	 * @param classes
	 *            an object whose KEYS are classes, or an array whose VALUES are
	 *            classes.
	 */
	addClasses: function(classes) {
		classes = hash.normalized(classes);
		for (var aClass in classes) {
			if (!this.mapClassnameToClassifier[aClass]) {
				this.mapClassnameToClassifier[aClass] = new this.binaryClassifierType(
					this.binaryClassifierOptions);
			}
		}
	},
	
	getAllClasses: function() {
		return Object.keys(this.mapClassnameToClassifier);
	},

	/**
	 * Tell the classifier that the given sample belongs to the given classes.
	 * 
	 * @param sample
	 *            a document.
	 * @param classes
	 *            an object whose KEYS are classes, or an array whose VALUES are classes.
	 */
	trainOnline: function(sample, classes) {
		classes = hash.normalized(classes);
		for ( var positiveClass in classes) {
			this.makeSureClassifierExists(positiveClass);
			this.mapClassnameToClassifier[positiveClass].trainOnline(sample, 1);
		}
		for ( var negativeClass in this.mapClassnameToClassifier) {
			if (!classes[negativeClass])
				this.mapClassnameToClassifier[negativeClass].trainOnline(sample, 0);
		}
	},

	/**
	 * Train the classifier with all the given documents.
	 * 
	 * @param dataset
	 *            an array with objects of the format: 
	 *            {input: sample1, output: [class11, class12...]}
	 */
	trainBatch : function(dataset) {
		// this variable will hold a dataset for each binary classifier:
		var mapClassnameToDataset = {}; 

		// create positive samples for each class:
		for ( var i = 0; i < dataset.length; ++i) {
			var sample = dataset[i].input;
			//console.dir(dataset[i]);
			dataset[i].output = hash.normalized(dataset[i].output);

			var classes = dataset[i].output;
			for ( var positiveClass in classes) {
				this.makeSureClassifierExists(positiveClass);
				if (!(positiveClass in mapClassnameToDataset)) // make sure dataset for this class exists
					mapClassnameToDataset[positiveClass] = [];
				mapClassnameToDataset[positiveClass].push({
					input : sample,
					output : 1
				})
			}
		}

		// create negative samples for each class (after all classes are in the  array):
		for ( var i = 0; i < dataset.length; ++i) {
			var sample = dataset[i].input;
			var classes = dataset[i].output;
			for ( var negativeClass in this.mapClassnameToClassifier) {
				if (!(negativeClass in mapClassnameToDataset)) // make sure dataset for this class exists
					mapClassnameToDataset[negativeClass] = [];
				if (!classes[negativeClass])
					mapClassnameToDataset[negativeClass].push({
						input : sample,
						output : 0
					})
			}
		}

		// train all classifiers:
		for (var aClass in mapClassnameToDataset) {
			//console.dir("TRAIN class="+aClass);
			this.mapClassnameToClassifier[aClass]
					.trainBatch(mapClassnameToDataset[aClass]);
		}
	},

	/**
	 * Use the model trained so far to classify a new sample.
	 * 
	 * @param sample a document.
	 * @param explain - int - if positive, an "explanation" field, with the given length, will be added to the result.
	 *  
	 * @return an array whose VALUES are classes.
	 */
	classify : function(sample, explain) {
		var classes = {};
		if (explain>0) {
			var positive_explanations = {};
			var negative_explanations = {};
		}
		for (var aClass in this.mapClassnameToClassifier) {
			var classifier = this.mapClassnameToClassifier[aClass];
			var classification = classifier.classify(sample, explain);
			if (classification.explanation) {
				var explanations_string = classification.explanation.reduce(function(a,b) {
					return a + " " + sprintf("%s%+1.2f",b.feature,b.relevance);
				}, "");
				if (classification.classification > 0.5) {
					classes[aClass] = true;
					if (explain>0) positive_explanations[aClass]=explanations_string;
				} else {
					if (explain>0) negative_explanations[aClass]=explanations_string;
				}
			} else {
				if (classification > 0.5)
					classes[aClass] = true;
			}
		}
		classes = Object.keys(classes);
		return (explain>0?
			{
				classes: classes, 
				explanation: {
					positive: positive_explanations, 
					negative: negative_explanations,
				}
			}:
			classes);
	},

	toJSON : function(callback) {
		var result = {};
		for ( var aClass in this.mapClassnameToClassifier) {
			var binaryClassifier = this.mapClassnameToClassifier[aClass];
			if (!binaryClassifier.toJSON) {
				console.dir(binaryClassifier);
				console.log("prototype: ");
				console.dir(binaryClassifier.__proto__);
				throw new Error("this binary classifier does not have a toJSON function");
			}
			result[aClass] = binaryClassifier.toJSON(callback);
		}
		return result;
	},

	fromJSON : function(json, callback) {
		for ( var aClass in json) {
			this.mapClassnameToClassifier[aClass] = new this.binaryClassifierType(
					this.binaryClassifierOptions);
			this.mapClassnameToClassifier[aClass].fromJSON(json[aClass]);
		}
		return this;
	},
	
	// private function: 
	makeSureClassifierExists: function(aClass) {
		if (!this.mapClassnameToClassifier[aClass]) { // make sure classifier exists
			this.mapClassnameToClassifier[aClass] = new this.binaryClassifierType(
					this.binaryClassifierOptions);
		}
	},
}


module.exports = BinaryRelevance;