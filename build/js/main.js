(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*=============================================================================
	Author:			Eric M. Barnard - @ericmbarnard								
	License:		MIT (http://opensource.org/licenses/mit-license.php)		
																				
	Description:	Validation Library for KnockoutJS							
	Version:		2.0.4											
===============================================================================
*/
/*globals require: false, exports: false, define: false, ko: false */

(function (factory) {
	// Module systems magic dance.

	if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
		// CommonJS or Node: hard-coded dependency on "knockout"
		factory(require("knockout"), exports);
	} else if (typeof define === "function" && define["amd"]) {
		// AMD anonymous module with hard-coded dependency on "knockout"
		define(["knockout", "exports"], factory);
	} else {
		// <script> tag: use the global `ko` object, attaching a `validation` property
		factory(ko, ko.validation = {});
	}
}(function ( ko, exports ) {

	if (typeof (ko) === 'undefined') {
		throw new Error('Knockout is required, please ensure it is loaded before loading this validation plug-in');
	}

	// create our namespace object
	ko.validation = exports;

	var kv = ko.validation,
		koUtils = ko.utils,
		unwrap = koUtils.unwrapObservable,
		forEach = koUtils.arrayForEach,
		extend = koUtils.extend;
;/*global ko: false*/

var defaults = {
	registerExtenders: true,
	messagesOnModified: true,
	errorsAsTitle: true,            // enables/disables showing of errors as title attribute of the target element.
	errorsAsTitleOnModified: false, // shows the error when hovering the input field (decorateElement must be true)
	messageTemplate: null,
	insertMessages: true,           // automatically inserts validation messages as <span></span>
	parseInputAttributes: false,    // parses the HTML5 validation attribute from a form element and adds that to the object
	writeInputAttributes: false,    // adds HTML5 input validation attributes to form elements that ko observable's are bound to
	decorateInputElement: false,         // false to keep backward compatibility
	decorateElementOnModified: true,// true to keep backward compatibility
	errorClass: null,               // single class for error message and element
	errorElementClass: 'validationElement',  // class to decorate error element
	errorMessageClass: 'validationMessage',  // class to decorate error message
	allowHtmlMessages: false,		// allows HTML in validation messages
	grouping: {
		deep: false,        //by default grouping is shallow
		observable: true,   //and using observables
		live: false		    //react to changes to observableArrays if observable === true
	},
	validate: {
		// throttle: 10
	}
};

// make a copy  so we can use 'reset' later
var configuration = extend({}, defaults);

configuration.html5Attributes = ['required', 'pattern', 'min', 'max', 'step'];
configuration.html5InputTypes = ['email', 'number', 'date'];

configuration.reset = function () {
	extend(configuration, defaults);
};

kv.configuration = configuration;
;kv.utils = (function () {
	var seedId = new Date().getTime();

	var domData = {}; //hash of data objects that we reference from dom elements
	var domDataKey = '__ko_validation__';

	return {
		isArray: function (o) {
			return o.isArray || Object.prototype.toString.call(o) === '[object Array]';
		},
		isObject: function (o) {
			return o !== null && typeof o === 'object';
		},
		isNumber: function(o) {
			return !isNaN(o);
		},
		isObservableArray: function(instance) {
			return !!instance &&
					typeof instance["remove"] === "function" &&
					typeof instance["removeAll"] === "function" &&
					typeof instance["destroy"] === "function" &&
					typeof instance["destroyAll"] === "function" &&
					typeof instance["indexOf"] === "function" &&
					typeof instance["replace"] === "function";
		},
		values: function (o) {
			var r = [];
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					r.push(o[i]);
				}
			}
			return r;
		},
		getValue: function (o) {
			return (typeof o === 'function' ? o() : o);
		},
		hasAttribute: function (node, attr) {
			return node.getAttribute(attr) !== null;
		},
		getAttribute: function (element, attr) {
			return element.getAttribute(attr);
		},
		setAttribute: function (element, attr, value) {
			return element.setAttribute(attr, value);
		},
		isValidatable: function (o) {
			return !!(o && o.rules && o.isValid && o.isModified);
		},
		insertAfter: function (node, newNode) {
			node.parentNode.insertBefore(newNode, node.nextSibling);
		},
		newId: function () {
			return seedId += 1;
		},
		getConfigOptions: function (element) {
			var options = kv.utils.contextFor(element);

			return options || kv.configuration;
		},
		setDomData: function (node, data) {
			var key = node[domDataKey];

			if (!key) {
				node[domDataKey] = key = kv.utils.newId();
			}

			domData[key] = data;
		},
		getDomData: function (node) {
			var key = node[domDataKey];

			if (!key) {
				return undefined;
			}

			return domData[key];
		},
		contextFor: function (node) {
			switch (node.nodeType) {
				case 1:
				case 8:
					var context = kv.utils.getDomData(node);
					if (context) { return context; }
					if (node.parentNode) { return kv.utils.contextFor(node.parentNode); }
					break;
			}
			return undefined;
		},
		isEmptyVal: function (val) {
			if (val === undefined) {
				return true;
			}
			if (val === null) {
				return true;
			}
			if (val === "") {
				return true;
			}
			return false;
		},
		getOriginalElementTitle: function (element) {
			var savedOriginalTitle = kv.utils.getAttribute(element, 'data-orig-title'),
				currentTitle = element.title,
				hasSavedOriginalTitle = kv.utils.hasAttribute(element, 'data-orig-title');

			return hasSavedOriginalTitle ?
				savedOriginalTitle : currentTitle;
		},
		async: function (expr) {
			if (window.setImmediate) { window.setImmediate(expr); }
			else { window.setTimeout(expr, 0); }
		},
		forEach: function (object, callback) {
			if (kv.utils.isArray(object)) {
				return forEach(object, callback);
			}
			for (var prop in object) {
				if (object.hasOwnProperty(prop)) {
					callback(object[prop], prop);
				}
			}
		}
	};
}());
;var api = (function () {

	var isInitialized = 0,
		configuration = kv.configuration,
		utils = kv.utils;

	function cleanUpSubscriptions(context) {
		forEach(context.subscriptions, function (subscription) {
			subscription.dispose();
		});
		context.subscriptions = [];
	}

	function dispose(context) {
		if (context.options.deep) {
			forEach(context.flagged, function (obj) {
				delete obj.__kv_traversed;
			});
			context.flagged.length = 0;
		}

		if (!context.options.live) {
			cleanUpSubscriptions(context);
		}
	}

	function traverseGraph(obj, context, level) {
		var objValues = [],
			val = obj.peek ? obj.peek() : obj;

		if (obj.__kv_traversed === true) {
			return;
		}

		if (context.options.deep) {
			obj.__kv_traversed = true;
			context.flagged.push(obj);
		}

		//default level value depends on deep option.
		level = (level !== undefined ? level : context.options.deep ? 1 : -1);

		// if object is observable then add it to the list
		if (ko.isObservable(obj)) {
			// ensure it's validatable but don't extend validatedObservable because it
			// would overwrite isValid property.
			if (!obj.errors && !utils.isValidatable(obj)) {
				obj.extend({ validatable: true });
			}
			context.validatables.push(obj);

			if (context.options.live && utils.isObservableArray(obj)) {
				context.subscriptions.push(obj.subscribe(function () {
					context.graphMonitor.valueHasMutated();
				}));
			}
		}

		//get list of values either from array or object but ignore non-objects
		// and destroyed objects
		if (val && !val._destroy) {
			if (utils.isArray(val)) {
				objValues = val;
			}
			else if (utils.isObject(val)) {
				objValues = utils.values(val);
			}
		}

		//process recursively if it is deep grouping
		if (level !== 0) {
			utils.forEach(objValues, function (observable) {
				//but not falsy things and not HTML Elements
				if (observable && !observable.nodeType && (!ko.isComputed(observable) || observable.rules)) {
					traverseGraph(observable, context, level + 1);
				}
			});
		}
	}

	function runTraversal(obj, context) {
		context.validatables = [];
		cleanUpSubscriptions(context);
		traverseGraph(obj, context);
		dispose(context);
	}

	function collectErrors(array) {
		var errors = [];
		forEach(array, function (observable) {
			// Do not collect validatedObservable errors
			if (utils.isValidatable(observable) && !observable.isValid()) {
				// Use peek because we don't want a dependency for 'error' property because it
				// changes before 'isValid' does. (Issue #99)
				errors.push(observable.error.peek());
			}
		});
		return errors;
	}

	return {
		//Call this on startup
		//any config can be overridden with the passed in options
		init: function (options, force) {
			//done run this multiple times if we don't really want to
			if (isInitialized > 0 && !force) {
				return;
			}

			//because we will be accessing options properties it has to be an object at least
			options = options || {};
			//if specific error classes are not provided then apply generic errorClass
			//it has to be done on option so that options.errorClass can override default
			//errorElementClass and errorMessage class but not those provided in options
			options.errorElementClass = options.errorElementClass || options.errorClass || configuration.errorElementClass;
			options.errorMessageClass = options.errorMessageClass || options.errorClass || configuration.errorMessageClass;

			extend(configuration, options);

			if (configuration.registerExtenders) {
				kv.registerExtenders();
			}

			isInitialized = 1;
		},

		// resets the config back to its original state
		reset: kv.configuration.reset,

		// recursively walks a viewModel and creates an object that
		// provides validation information for the entire viewModel
		// obj -> the viewModel to walk
		// options -> {
		//	  deep: false, // if true, will walk past the first level of viewModel properties
		//	  observable: false // if true, returns a computed observable indicating if the viewModel is valid
		// }
		group: function group(obj, options) { // array of observables or viewModel
			options = extend(extend({}, configuration.grouping), options);

			var context = {
				options: options,
				graphMonitor: ko.observable(),
				flagged: [],
				subscriptions: [],
				validatables: []
			};

			var result = null;

			//if using observables then traverse structure once and add observables
			if (options.observable) {
				result = ko.computed(function () {
					context.graphMonitor(); //register dependency
					runTraversal(obj, context);
					return collectErrors(context.validatables);
				});
			}
			else { //if not using observables then every call to error() should traverse the structure
				result = function () {
					runTraversal(obj, context);
					return collectErrors(context.validatables);
				};
			}

			result.showAllMessages = function (show) { // thanks @heliosPortal
				if (show === undefined) {//default to true
					show = true;
				}

				result.forEach(function (observable) {
					if (utils.isValidatable(observable)) {
						observable.isModified(show);
					}
				});
			};

			result.isAnyMessageShown = function () {
				var invalidAndModifiedPresent;

				invalidAndModifiedPresent = !!result.find(function (observable) {
					return utils.isValidatable(observable) && !observable.isValid() && observable.isModified();
				});
				return invalidAndModifiedPresent;
			};

			result.filter = function(predicate) {
				predicate = predicate || function () { return true; };
				// ensure we have latest changes
				result();

				return koUtils.arrayFilter(context.validatables, predicate);
			};

			result.find = function(predicate) {
				predicate = predicate || function () { return true; };
				// ensure we have latest changes
				result();

				return koUtils.arrayFirst(context.validatables, predicate);
			};

			result.forEach = function(callback) {
				callback = callback || function () { };
				// ensure we have latest changes
				result();

				forEach(context.validatables, callback);
			};

			result.map = function(mapping) {
				mapping = mapping || function (item) { return item; };
				// ensure we have latest changes
				result();

				return koUtils.arrayMap(context.validatables, mapping);
			};

			/**
			 * @private You should not rely on this method being here.
			 * It's a private method and it may change in the future.
			 *
			 * @description Updates the validated object and collects errors from it.
			 */
			result._updateState = function(newValue) {
				if (!utils.isObject(newValue)) {
					throw new Error('An object is required.');
				}
				obj = newValue;
				if (options.observable) {
					context.graphMonitor.valueHasMutated();
				}
				else {
					runTraversal(newValue, context);
					return collectErrors(context.validatables);
				}
			};
			return result;
		},

		formatMessage: function (message, params, observable) {
			if (utils.isObject(params) && params.typeAttr) {
				params = params.value;
			}
			if (typeof message === 'function') {
				return message(params, observable);
			}
			var replacements = unwrap(params);
			if (replacements == null) {
				replacements = [];
			}
			if (!utils.isArray(replacements)) {
				replacements = [replacements];
			}
			return message.replace(/{(\d+)}/gi, function(match, index) {
				if (typeof replacements[index] !== 'undefined') {
					return replacements[index];
				}
				return match;
			});
		},

		// addRule:
		// This takes in a ko.observable and a Rule Context - which is just a rule name and params to supply to the validator
		// ie: kv.addRule(myObservable, {
		//		  rule: 'required',
		//		  params: true
		//	  });
		//
		addRule: function (observable, rule) {
			observable.extend({ validatable: true });

			var hasRule = !!koUtils.arrayFirst(observable.rules(), function(item) {
				return item.rule && item.rule === rule.rule;
			});

			if (!hasRule) {
				//push a Rule Context to the observables local array of Rule Contexts
				observable.rules.push(rule);
			}
			return observable;
		},

		// addAnonymousRule:
		// Anonymous Rules essentially have all the properties of a Rule, but are only specific for a certain property
		// and developers typically are wanting to add them on the fly or not register a rule with the 'kv.rules' object
		//
		// Example:
		// var test = ko.observable('something').extend{(
		//	  validation: {
		//		  validator: function(val, someOtherVal){
		//			  return true;
		//		  },
		//		  message: "Something must be really wrong!',
		//		  params: true
		//	  }
		//  )};
		addAnonymousRule: function (observable, ruleObj) {
			if (ruleObj['message'] === undefined) {
				ruleObj['message'] = 'Error';
			}

			//make sure onlyIf is honoured
			if (ruleObj.onlyIf) {
				ruleObj.condition = ruleObj.onlyIf;
			}

			//add the anonymous rule to the observable
			kv.addRule(observable, ruleObj);
		},

		addExtender: function (ruleName) {
			ko.extenders[ruleName] = function (observable, params) {
				//params can come in a few flavors
				// 1. Just the params to be passed to the validator
				// 2. An object containing the Message to be used and the Params to pass to the validator
				// 3. A condition when the validation rule to be applied
				//
				// Example:
				// var test = ko.observable(3).extend({
				//	  max: {
				//		  message: 'This special field has a Max of {0}',
				//		  params: 2,
				//		  onlyIf: function() {
				//			return specialField.IsVisible();
				//		  }
				//	  }
				//  )};
				//
				if (params && (params.message || params.onlyIf)) { //if it has a message or condition object, then its an object literal to use
					return kv.addRule(observable, {
						rule: ruleName,
						message: params.message,
						params: utils.isEmptyVal(params.params) ? true : params.params,
						condition: params.onlyIf
					});
				} else {
					return kv.addRule(observable, {
						rule: ruleName,
						params: params
					});
				}
			};
		},

		// loops through all kv.rules and adds them as extenders to
		// ko.extenders
		registerExtenders: function () { // root extenders optional, use 'validation' extender if would cause conflicts
			if (configuration.registerExtenders) {
				for (var ruleName in kv.rules) {
					if (kv.rules.hasOwnProperty(ruleName)) {
						if (!ko.extenders[ruleName]) {
							kv.addExtender(ruleName);
						}
					}
				}
			}
		},

		//creates a span next to the @element with the specified error class
		insertValidationMessage: function (element) {
			var span = document.createElement('SPAN');
			span.className = utils.getConfigOptions(element).errorMessageClass;
			utils.insertAfter(element, span);
			return span;
		},

		// if html-5 validation attributes have been specified, this parses
		// the attributes on @element
		parseInputValidationAttributes: function (element, valueAccessor) {
			forEach(kv.configuration.html5Attributes, function (attr) {
				if (utils.hasAttribute(element, attr)) {

					var params = element.getAttribute(attr) || true;

					if (attr === 'min' || attr === 'max')
					{
						// If we're validating based on the min and max attributes, we'll
						// need to know what the 'type' attribute is set to
						var typeAttr = element.getAttribute('type');
						if (typeof typeAttr === "undefined" || !typeAttr)
						{
							// From http://www.w3.org/TR/html-markup/input:
							//   An input element with no type attribute specified represents the
							//   same thing as an input element with its type attribute set to "text".
							typeAttr = "text";
						}
						params = {typeAttr: typeAttr, value: params};
					}

					kv.addRule(valueAccessor(), {
						rule: attr,
						params: params
					});
				}
			});

			var currentType = element.getAttribute('type');
			forEach(kv.configuration.html5InputTypes, function (type) {
				if (type === currentType) {
					kv.addRule(valueAccessor(), {
						rule: (type === 'date') ? 'dateISO' : type,
						params: true
					});
				}
			});
		},

		// writes html5 validation attributes on the element passed in
		writeInputValidationAttributes: function (element, valueAccessor) {
			var observable = valueAccessor();

			if (!observable || !observable.rules) {
				return;
			}

			var contexts = observable.rules(); // observable array

			// loop through the attributes and add the information needed
			forEach(kv.configuration.html5Attributes, function (attr) {
				var ctx = koUtils.arrayFirst(contexts, function (ctx) {
					return ctx.rule && ctx.rule.toLowerCase() === attr.toLowerCase();
				});

				if (!ctx) {
					return;
				}

				// we have a rule matching a validation attribute at this point
				// so lets add it to the element along with the params
				ko.computed({
					read: function() {
						var params = ko.unwrap(ctx.params);

						// we have to do some special things for the pattern validation
						if (ctx.rule === "pattern" && params instanceof RegExp) {
							// we need the pure string representation of the RegExpr without the //gi stuff
							params = params.source;
						}

						element.setAttribute(attr, params);
					},
					disposeWhenNodeIsRemoved: element
				});
			});

			contexts = null;
		},

		//take an existing binding handler and make it cause automatic validations
		makeBindingHandlerValidatable: function (handlerName) {
			var init = ko.bindingHandlers[handlerName].init;

			ko.bindingHandlers[handlerName].init = function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

				init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);

				return ko.bindingHandlers['validationCore'].init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
			};
		},

		// visit an objects properties and apply validation rules from a definition
		setRules: function (target, definition) {
			var setRules = function (target, definition) {
				if (!target || !definition) { return; }

				for (var prop in definition) {
					if (!definition.hasOwnProperty(prop)) { continue; }
					var ruleDefinitions = definition[prop];

					//check the target property exists and has a value
					if (!target[prop]) { continue; }
					var targetValue = target[prop],
						unwrappedTargetValue = unwrap(targetValue),
						rules = {},
						nonRules = {};

					for (var rule in ruleDefinitions) {
						if (!ruleDefinitions.hasOwnProperty(rule)) { continue; }
						if (kv.rules[rule]) {
							rules[rule] = ruleDefinitions[rule];
						} else {
							nonRules[rule] = ruleDefinitions[rule];
						}
					}

					//apply rules
					if (ko.isObservable(targetValue)) {
						targetValue.extend(rules);
					}

					//then apply child rules
					//if it's an array, apply rules to all children
					if (unwrappedTargetValue && utils.isArray(unwrappedTargetValue)) {
						for (var i = 0; i < unwrappedTargetValue.length; i++) {
							setRules(unwrappedTargetValue[i], nonRules);
						}
						//otherwise, just apply to this property
					} else {
						setRules(unwrappedTargetValue, nonRules);
					}
				}
			};
			setRules(target, definition);
		}
	};

}());

// expose api publicly
extend(ko.validation, api);
;//Validation Rules:
// You can view and override messages or rules via:
// kv.rules[ruleName]
//
// To implement a custom Rule, simply use this template:
// kv.rules['<custom rule name>'] = {
//      validator: function (val, param) {
//          <custom logic>
//          return <true or false>;
//      },
//      message: '<custom validation message>' //optionally you can also use a '{0}' to denote a placeholder that will be replaced with your 'param'
// };
//
// Example:
// kv.rules['mustEqual'] = {
//      validator: function( val, mustEqualVal ){
//          return val === mustEqualVal;
//      },
//      message: 'This field must equal {0}'
// };
//
kv.rules = {};
kv.rules['required'] = {
	validator: function (val, required) {
		var testVal;

		if (val === undefined || val === null) {
			return !required;
		}

		testVal = val;
		if (typeof (val) === 'string') {
			if (String.prototype.trim) {
				testVal = val.trim();
			}
			else {
				testVal = val.replace(/^\s+|\s+$/g, '');
			}
		}

		if (!required) {// if they passed: { required: false }, then don't require this
			return true;
		}

		return ((testVal + '').length > 0);
	},
	message: 'This field is required.'
};

function minMaxValidatorFactory(validatorName) {
	var isMaxValidation = validatorName === "max";

	return function (val, options) {
		if (kv.utils.isEmptyVal(val)) {
			return true;
		}

		var comparisonValue, type;
		if (options.typeAttr === undefined) {
			// This validator is being called from javascript rather than
			// being bound from markup
			type = "text";
			comparisonValue = options;
		} else {
			type = options.typeAttr;
			comparisonValue = options.value;
		}

		// From http://www.w3.org/TR/2012/WD-html5-20121025/common-input-element-attributes.html#attr-input-min,
		// if the value is parseable to a number, then the minimum should be numeric
		if (!isNaN(comparisonValue) && !(comparisonValue instanceof Date)) {
			type = "number";
		}

		var regex, valMatches, comparisonValueMatches;
		switch (type.toLowerCase()) {
			case "week":
				regex = /^(\d{4})-W(\d{2})$/;
				valMatches = val.match(regex);
				if (valMatches === null) {
					throw new Error("Invalid value for " + validatorName + " attribute for week input.  Should look like " +
						"'2000-W33' http://www.w3.org/TR/html-markup/input.week.html#input.week.attrs.min");
				}
				comparisonValueMatches = comparisonValue.match(regex);
				// If no regex matches were found, validation fails
				if (!comparisonValueMatches) {
					return false;
				}

				if (isMaxValidation) {
					return (valMatches[1] < comparisonValueMatches[1]) || // older year
						// same year, older week
						((valMatches[1] === comparisonValueMatches[1]) && (valMatches[2] <= comparisonValueMatches[2]));
				} else {
					return (valMatches[1] > comparisonValueMatches[1]) || // newer year
						// same year, newer week
						((valMatches[1] === comparisonValueMatches[1]) && (valMatches[2] >= comparisonValueMatches[2]));
				}
				break;

			case "month":
				regex = /^(\d{4})-(\d{2})$/;
				valMatches = val.match(regex);
				if (valMatches === null) {
					throw new Error("Invalid value for " + validatorName + " attribute for month input.  Should look like " +
						"'2000-03' http://www.w3.org/TR/html-markup/input.month.html#input.month.attrs.min");
				}
				comparisonValueMatches = comparisonValue.match(regex);
				// If no regex matches were found, validation fails
				if (!comparisonValueMatches) {
					return false;
				}

				if (isMaxValidation) {
					return ((valMatches[1] < comparisonValueMatches[1]) || // older year
						// same year, older month
						((valMatches[1] === comparisonValueMatches[1]) && (valMatches[2] <= comparisonValueMatches[2])));
				} else {
					return (valMatches[1] > comparisonValueMatches[1]) || // newer year
						// same year, newer month
						((valMatches[1] === comparisonValueMatches[1]) && (valMatches[2] >= comparisonValueMatches[2]));
				}
				break;

			case "number":
			case "range":
				if (isMaxValidation) {
					return (!isNaN(val) && parseFloat(val) <= parseFloat(comparisonValue));
				} else {
					return (!isNaN(val) && parseFloat(val) >= parseFloat(comparisonValue));
				}
				break;

			default:
				if (isMaxValidation) {
					return val <= comparisonValue;
				} else {
					return val >= comparisonValue;
				}
		}
	};
}

kv.rules['min'] = {
	validator: minMaxValidatorFactory("min"),
	message: 'Please enter a value greater than or equal to {0}.'
};

kv.rules['max'] = {
	validator: minMaxValidatorFactory("max"),
	message: 'Please enter a value less than or equal to {0}.'
};

kv.rules['minLength'] = {
	validator: function (val, minLength) {
		if(kv.utils.isEmptyVal(val)) { return true; }
		var normalizedVal = kv.utils.isNumber(val) ? ('' + val) : val;
		return normalizedVal.length >= minLength;
	},
	message: 'Please enter at least {0} characters.'
};

kv.rules['maxLength'] = {
	validator: function (val, maxLength) {
		if(kv.utils.isEmptyVal(val)) { return true; }
		var normalizedVal = kv.utils.isNumber(val) ? ('' + val) : val;
		return normalizedVal.length <= maxLength;
	},
	message: 'Please enter no more than {0} characters.'
};

kv.rules['pattern'] = {
	validator: function (val, regex) {
		return kv.utils.isEmptyVal(val) || val.toString().match(regex) !== null;
	},
	message: 'Please check this value.'
};

kv.rules['step'] = {
	validator: function (val, step) {

		// in order to handle steps of .1 & .01 etc.. Modulus won't work
		// if the value is a decimal, so we have to correct for that
		if (kv.utils.isEmptyVal(val) || step === 'any') { return true; }
		var dif = (val * 100) % (step * 100);
		return Math.abs(dif) < 0.00001 || Math.abs(1 - dif) < 0.00001;
	},
	message: 'The value must increment by {0}.'
};

kv.rules['email'] = {
	validator: function (val, validate) {
		if (!validate) { return true; }

		//I think an empty email address is also a valid entry
		//if one want's to enforce entry it should be done with 'required: true'
		return kv.utils.isEmptyVal(val) || (
			// jquery validate regex - thanks Scott Gonzalez
			validate && /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(val)
		);
	},
	message: 'Please enter a proper email address.'
};

kv.rules['date'] = {
	validator: function (value, validate) {
		if (!validate) { return true; }
		return kv.utils.isEmptyVal(value) || (validate && !/Invalid|NaN/.test(new Date(value)));
	},
	message: 'Please enter a proper date.'
};

kv.rules['dateISO'] = {
	validator: function (value, validate) {
		if (!validate) { return true; }
		return kv.utils.isEmptyVal(value) || (validate && /^\d{4}[-/](?:0?[1-9]|1[012])[-/](?:0?[1-9]|[12][0-9]|3[01])$/.test(value));
	},
	message: 'Please enter a proper date.'
};

kv.rules['number'] = {
	validator: function (value, validate) {
		if (!validate) { return true; }
		return kv.utils.isEmptyVal(value) || (validate && /^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(value));
	},
	message: 'Please enter a number.'
};

kv.rules['digit'] = {
	validator: function (value, validate) {
		if (!validate) { return true; }
		return kv.utils.isEmptyVal(value) || (validate && /^\d+$/.test(value));
	},
	message: 'Please enter a digit.'
};

kv.rules['phoneUS'] = {
	validator: function (phoneNumber, validate) {
		if (!validate) { return true; }
		if (kv.utils.isEmptyVal(phoneNumber)) { return true; } // makes it optional, use 'required' rule if it should be required
		if (typeof (phoneNumber) !== 'string') { return false; }
		phoneNumber = phoneNumber.replace(/\s+/g, "");
		return validate && phoneNumber.length > 9 && phoneNumber.match(/^(1-?)?(\([2-9]\d{2}\)|[2-9]\d{2})-?[2-9]\d{2}-?\d{4}$/);
	},
	message: 'Please specify a valid phone number.'
};

kv.rules['equal'] = {
	validator: function (val, params) {
		var otherValue = params;
		return val === kv.utils.getValue(otherValue);
	},
	message: 'Values must equal.'
};

kv.rules['notEqual'] = {
	validator: function (val, params) {
		var otherValue = params;
		return val !== kv.utils.getValue(otherValue);
	},
	message: 'Please choose another value.'
};

//unique in collection
// options are:
//    collection: array or function returning (observable) array
//              in which the value has to be unique
//    valueAccessor: function that returns value from an object stored in collection
//              if it is null the value is compared directly
//    external: set to true when object you are validating is automatically updating collection
kv.rules['unique'] = {
	validator: function (val, options) {
		var c = kv.utils.getValue(options.collection),
			external = kv.utils.getValue(options.externalValue),
			counter = 0;

		if (!val || !c) { return true; }

		koUtils.arrayFilter(c, function (item) {
			if (val === (options.valueAccessor ? options.valueAccessor(item) : item)) { counter++; }
		});
		// if value is external even 1 same value in collection means the value is not unique
		return counter < (!!external ? 1 : 2);
	},
	message: 'Please make sure the value is unique.'
};


//now register all of these!
(function () {
	kv.registerExtenders();
}());
;// The core binding handler
// this allows us to setup any value binding that internally always
// performs the same functionality
ko.bindingHandlers['validationCore'] = (function () {

	return {
		init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			var config = kv.utils.getConfigOptions(element);
			var observable = valueAccessor();

			// parse html5 input validation attributes, optional feature
			if (config.parseInputAttributes) {
				kv.utils.async(function () { kv.parseInputValidationAttributes(element, valueAccessor); });
			}

			// if requested insert message element and apply bindings
			if (config.insertMessages && kv.utils.isValidatable(observable)) {

				// insert the <span></span>
				var validationMessageElement = kv.insertValidationMessage(element);

				// if we're told to use a template, make sure that gets rendered
				if (config.messageTemplate) {
					ko.renderTemplate(config.messageTemplate, { field: observable }, null, validationMessageElement, 'replaceNode');
				} else {
					ko.applyBindingsToNode(validationMessageElement, { validationMessage: observable });
				}
			}

			// write the html5 attributes if indicated by the config
			if (config.writeInputAttributes && kv.utils.isValidatable(observable)) {

				kv.writeInputValidationAttributes(element, valueAccessor);
			}

			// if requested, add binding to decorate element
			if (config.decorateInputElement && kv.utils.isValidatable(observable)) {
				ko.applyBindingsToNode(element, { validationElement: observable });
			}
		}
	};

}());

// override for KO's default 'value', 'checked', 'textInput' and selectedOptions bindings
kv.makeBindingHandlerValidatable("value");
kv.makeBindingHandlerValidatable("checked");
if (ko.bindingHandlers.textInput) {
	kv.makeBindingHandlerValidatable("textInput");
}
kv.makeBindingHandlerValidatable("selectedOptions");


ko.bindingHandlers['validationMessage'] = { // individual error message, if modified or post binding
	update: function (element, valueAccessor) {
		var obsv = valueAccessor(),
			config = kv.utils.getConfigOptions(element),
			val = unwrap(obsv),
			msg = null,
			isModified = false,
			isValid = false;

		if (obsv === null || typeof obsv === 'undefined') {
			throw new Error('Cannot bind validationMessage to undefined value. data-bind expression: ' +
				element.getAttribute('data-bind'));
		}

		isModified = obsv.isModified && obsv.isModified();
		isValid = obsv.isValid && obsv.isValid();

		var error = null;
		if (!config.messagesOnModified || isModified) {
			error = isValid ? null : obsv.error;
		}

		var isVisible = !config.messagesOnModified || isModified ? !isValid : false;
		var isCurrentlyVisible = element.style.display !== "none";

		if (config.allowHtmlMessages) {
			koUtils.setHtml(element, error);
		} else {
			ko.bindingHandlers.text.update(element, function () { return error; });
		}

		if (isCurrentlyVisible && !isVisible) {
			element.style.display = 'none';
		} else if (!isCurrentlyVisible && isVisible) {
			element.style.display = '';
		}
	}
};

ko.bindingHandlers['validationElement'] = {
	update: function (element, valueAccessor, allBindingsAccessor) {
		var obsv = valueAccessor(),
			config = kv.utils.getConfigOptions(element),
			val = unwrap(obsv),
			msg = null,
			isModified = false,
			isValid = false;

		if (obsv === null || typeof obsv === 'undefined') {
			throw new Error('Cannot bind validationElement to undefined value. data-bind expression: ' +
				element.getAttribute('data-bind'));
		}

		isModified = obsv.isModified && obsv.isModified();
		isValid = obsv.isValid && obsv.isValid();

		// create an evaluator function that will return something like:
		// css: { validationElement: true }
		var cssSettingsAccessor = function () {
			var css = {};

			var shouldShow = ((!config.decorateElementOnModified || isModified) ? !isValid : false);

			// css: { validationElement: false }
			css[config.errorElementClass] = shouldShow;

			return css;
		};

		//add or remove class on the element;
		ko.bindingHandlers.css.update(element, cssSettingsAccessor, allBindingsAccessor);
		if (!config.errorsAsTitle) { return; }

		ko.bindingHandlers.attr.update(element, function () {
			var
				hasModification = !config.errorsAsTitleOnModified || isModified,
				title = kv.utils.getOriginalElementTitle(element);

			if (hasModification && !isValid) {
				return { title: obsv.error, 'data-orig-title': title };
			} else if (!hasModification || isValid) {
				return { title: title, 'data-orig-title': null };
			}
		});
	}
};

// ValidationOptions:
// This binding handler allows you to override the initial config by setting any of the options for a specific element or context of elements
//
// Example:
// <div data-bind="validationOptions: { insertMessages: true, messageTemplate: 'customTemplate', errorMessageClass: 'mySpecialClass'}">
//      <input type="text" data-bind="value: someValue"/>
//      <input type="text" data-bind="value: someValue2"/>
// </div>
ko.bindingHandlers['validationOptions'] = (function () {
	return {
		init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
			var options = unwrap(valueAccessor());
			if (options) {
				var newConfig = extend({}, kv.configuration);
				extend(newConfig, options);

				//store the validation options on the node so we can retrieve it later
				kv.utils.setDomData(element, newConfig);
			}
		}
	};
}());
;// Validation Extender:
// This is for creating custom validation logic on the fly
// Example:
// var test = ko.observable('something').extend{(
//      validation: {
//          validator: function(val, someOtherVal){
//              return true;
//          },
//          message: "Something must be really wrong!',
//          params: true
//      }
//  )};
ko.extenders['validation'] = function (observable, rules) { // allow single rule or array
	forEach(kv.utils.isArray(rules) ? rules : [rules], function (rule) {
		// the 'rule' being passed in here has no name to identify a core Rule,
		// so we add it as an anonymous rule
		// If the developer is wanting to use a core Rule, but use a different message see the 'addExtender' logic for examples
		kv.addAnonymousRule(observable, rule);
	});
	return observable;
};

//This is the extender that makes a Knockout Observable also 'Validatable'
//examples include:
// 1. var test = ko.observable('something').extend({validatable: true});
// this will ensure that the Observable object is setup properly to respond to rules
//
// 2. test.extend({validatable: false});
// this will remove the validation properties from the Observable object should you need to do that.
ko.extenders['validatable'] = function (observable, options) {
	if (!kv.utils.isObject(options)) {
		options = { enable: options };
	}

	if (!('enable' in options)) {
		options.enable = true;
	}

	if (options.enable && !kv.utils.isValidatable(observable)) {
		var config = kv.configuration.validate || {};
		var validationOptions = {
			throttleEvaluation : options.throttle || config.throttle
		};

		observable.error = ko.observable(null); // holds the error message, we only need one since we stop processing validators when one is invalid

		// observable.rules:
		// ObservableArray of Rule Contexts, where a Rule Context is simply the name of a rule and the params to supply to it
		//
		// Rule Context = { rule: '<rule name>', params: '<passed in params>', message: '<Override of default Message>' }
		observable.rules = ko.observableArray(); //holds the rule Contexts to use as part of validation

		//in case async validation is occurring
		observable.isValidating = ko.observable(false);

		//the true holder of whether the observable is valid or not
		observable.__valid__ = ko.observable(true);

		observable.isModified = ko.observable(false);

		// a semi-protected observable
		observable.isValid = ko.computed(observable.__valid__);

		//manually set error state
		observable.setError = function (error) {
			var previousError = observable.error.peek();
			var previousIsValid = observable.__valid__.peek();

			observable.error(error);
			observable.__valid__(false);

			if (previousError !== error && !previousIsValid) {
				// if the observable was not valid before then isValid will not mutate,
				// hence causing any grouping to not display the latest error.
				observable.isValid.notifySubscribers();
			}
		};

		//manually clear error state
		observable.clearError = function () {
			observable.error(null);
			observable.__valid__(true);
			return observable;
		};

		//subscribe to changes in the observable
		var h_change = observable.subscribe(function () {
			observable.isModified(true);
		});

		// we use a computed here to ensure that anytime a dependency changes, the
		// validation logic evaluates
		var h_obsValidationTrigger = ko.computed(extend({
			read: function () {
				var obs = observable(),
					ruleContexts = observable.rules();

				kv.validateObservable(observable);

				return true;
			}
		}, validationOptions));

		extend(h_obsValidationTrigger, validationOptions);

		observable._disposeValidation = function () {
			//first dispose of the subscriptions
			observable.isValid.dispose();
			observable.rules.removeAll();
			h_change.dispose();
			h_obsValidationTrigger.dispose();

			delete observable['rules'];
			delete observable['error'];
			delete observable['isValid'];
			delete observable['isValidating'];
			delete observable['__valid__'];
			delete observable['isModified'];
            delete observable['setError'];
            delete observable['clearError'];
            delete observable['_disposeValidation'];
		};
	} else if (options.enable === false && observable._disposeValidation) {
		observable._disposeValidation();
	}
	return observable;
};

function validateSync(observable, rule, ctx) {
	//Execute the validator and see if its valid
	if (!rule.validator(observable(), (ctx.params === undefined ? true : unwrap(ctx.params)))) { // default param is true, eg. required = true

		//not valid, so format the error message and stick it in the 'error' variable
		observable.setError(kv.formatMessage(
					ctx.message || rule.message,
					unwrap(ctx.params),
					observable));
		return false;
	} else {
		return true;
	}
}

function validateAsync(observable, rule, ctx) {
	observable.isValidating(true);

	var callBack = function (valObj) {
		var isValid = false,
			msg = '';

		if (!observable.__valid__()) {

			// since we're returning early, make sure we turn this off
			observable.isValidating(false);

			return; //if its already NOT valid, don't add to that
		}

		//we were handed back a complex object
		if (valObj['message']) {
			isValid = valObj.isValid;
			msg = valObj.message;
		} else {
			isValid = valObj;
		}

		if (!isValid) {
			//not valid, so format the error message and stick it in the 'error' variable
			observable.error(kv.formatMessage(
				msg || ctx.message || rule.message,
				unwrap(ctx.params),
				observable));
			observable.__valid__(isValid);
		}

		// tell it that we're done
		observable.isValidating(false);
	};

	kv.utils.async(function() {
	    //fire the validator and hand it the callback
        rule.validator(observable(), ctx.params === undefined ? true : unwrap(ctx.params), callBack);
	});
}

kv.validateObservable = function (observable) {
	var i = 0,
		rule, // the rule validator to execute
		ctx, // the current Rule Context for the loop
		ruleContexts = observable.rules(), //cache for iterator
		len = ruleContexts.length; //cache for iterator

	for (; i < len; i++) {

		//get the Rule Context info to give to the core Rule
		ctx = ruleContexts[i];

		// checks an 'onlyIf' condition
		if (ctx.condition && !ctx.condition()) {
			continue;
		}

		//get the core Rule to use for validation
		rule = ctx.rule ? kv.rules[ctx.rule] : ctx;

		if (rule['async'] || ctx['async']) {
			//run async validation
			validateAsync(observable, rule, ctx);

		} else {
			//run normal sync validation
			if (!validateSync(observable, rule, ctx)) {
				return false; //break out of the loop
			}
		}
	}
	//finally if we got this far, make the observable valid again!
	observable.clearError();
	return true;
};
;
var _locales = {};
var _currentLocale;

kv.defineLocale = function(name, values) {
	if (name && values) {
		_locales[name.toLowerCase()] = values;
		return values;
	}
	return null;
};

kv.locale = function(name) {
	if (name) {
		name = name.toLowerCase();

		if (_locales.hasOwnProperty(name)) {
			kv.localize(_locales[name]);
			_currentLocale = name;
		}
		else {
			throw new Error('Localization ' + name + ' has not been loaded.');
		}
	}
	return _currentLocale;
};

//quick function to override rule messages
kv.localize = function (msgTranslations) {
	var rules = kv.rules;

	//loop the properties in the object and assign the msg to the rule
	for (var ruleName in msgTranslations) {
		if (rules.hasOwnProperty(ruleName)) {
			rules[ruleName].message = msgTranslations[ruleName];
		}
	}
};

// Populate default locale (this will make en-US.js somewhat redundant)
(function() {
	var localeData = {};
	var rules = kv.rules;

	for (var ruleName in rules) {
		if (rules.hasOwnProperty(ruleName)) {
			localeData[ruleName] = rules[ruleName].message;
		}
	}
	kv.defineLocale('en-us', localeData);
})();

// No need to invoke locale because the messages are already defined along with the rules for en-US
_currentLocale = 'en-us';
;/**
 * Possible invocations:
 * 		applyBindingsWithValidation(viewModel)
 * 		applyBindingsWithValidation(viewModel, options)
 * 		applyBindingsWithValidation(viewModel, rootNode)
 *		applyBindingsWithValidation(viewModel, rootNode, options)
 */
ko.applyBindingsWithValidation = function (viewModel, rootNode, options) {
	var node = document.body,
		config;

	if (rootNode && rootNode.nodeType) {
		node = rootNode;
		config = options;
	}
	else {
		config = rootNode;
	}

	kv.init();

	if (config) {
		config = extend(extend({}, kv.configuration), config);
		kv.utils.setDomData(node, config);
	}

	ko.applyBindings(viewModel, node);
};

//override the original applyBindings so that we can ensure all new rules and what not are correctly registered
var origApplyBindings = ko.applyBindings;
ko.applyBindings = function () {
	kv.init();
	origApplyBindings.apply(this, arguments);
};

ko.validatedObservable = function (initialValue, options) {
	if (!options && !kv.utils.isObject(initialValue)) {
		return ko.observable(initialValue).extend({ validatable: true });
	}

	var obsv = ko.observable(initialValue);
	obsv.errors = kv.group(kv.utils.isObject(initialValue) ? initialValue : {}, options);
	obsv.isValid = ko.observable(obsv.errors().length === 0);

	if (ko.isObservable(obsv.errors)) {
		obsv.errors.subscribe(function(errors) {
			obsv.isValid(errors.length === 0);
		});
	}
	else {
		ko.computed(obsv.errors).subscribe(function (errors) {
			obsv.isValid(errors.length === 0);
		});
	}

	obsv.subscribe(function(newValue) {
		if (!kv.utils.isObject(newValue)) {
			/*
			 * The validation group works on objects.
			 * Since the new value is a primitive (scalar, null or undefined) we need
			 * to create an empty object to pass along.
			 */
			newValue = {};
		}
		// Force the group to refresh
		obsv.errors._updateState(newValue);
		obsv.isValid(obsv.errors().length === 0);
	});

	return obsv;
};
;}));
},{"knockout":2}],2:[function(require,module,exports){
/*!
 * Knockout JavaScript library v3.5.1
 * (c) The Knockout.js team - http://knockoutjs.com/
 * License: MIT (http://www.opensource.org/licenses/mit-license.php)
 */

(function() {(function(n){var A=this||(0,eval)("this"),w=A.document,R=A.navigator,v=A.jQuery,H=A.JSON;v||"undefined"===typeof jQuery||(v=jQuery);(function(n){"function"===typeof define&&define.amd?define(["exports","require"],n):"object"===typeof exports&&"object"===typeof module?n(module.exports||exports):n(A.ko={})})(function(S,T){function K(a,c){return null===a||typeof a in W?a===c:!1}function X(b,c){var d;return function(){d||(d=a.a.setTimeout(function(){d=n;b()},c))}}function Y(b,c){var d;return function(){clearTimeout(d);
d=a.a.setTimeout(b,c)}}function Z(a,c){c&&"change"!==c?"beforeChange"===c?this.pc(a):this.gb(a,c):this.qc(a)}function aa(a,c){null!==c&&c.s&&c.s()}function ba(a,c){var d=this.qd,e=d[r];e.ra||(this.Qb&&this.mb[c]?(d.uc(c,a,this.mb[c]),this.mb[c]=null,--this.Qb):e.I[c]||d.uc(c,a,e.J?{da:a}:d.$c(a)),a.Ja&&a.gd())}var a="undefined"!==typeof S?S:{};a.b=function(b,c){for(var d=b.split("."),e=a,f=0;f<d.length-1;f++)e=e[d[f]];e[d[d.length-1]]=c};a.L=function(a,c,d){a[c]=d};a.version="3.5.1";a.b("version",
a.version);a.options={deferUpdates:!1,useOnlyNativeEvents:!1,foreachHidesDestroyed:!1};a.a=function(){function b(a,b){for(var c in a)f.call(a,c)&&b(c,a[c])}function c(a,b){if(b)for(var c in b)f.call(b,c)&&(a[c]=b[c]);return a}function d(a,b){a.__proto__=b;return a}function e(b,c,d,e){var l=b[c].match(q)||[];a.a.D(d.match(q),function(b){a.a.Na(l,b,e)});b[c]=l.join(" ")}var f=Object.prototype.hasOwnProperty,g={__proto__:[]}instanceof Array,h="function"===typeof Symbol,m={},k={};m[R&&/Firefox\/2/i.test(R.userAgent)?
"KeyboardEvent":"UIEvents"]=["keyup","keydown","keypress"];m.MouseEvents="click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave".split(" ");b(m,function(a,b){if(b.length)for(var c=0,d=b.length;c<d;c++)k[b[c]]=a});var l={propertychange:!0},p=w&&function(){for(var a=3,b=w.createElement("div"),c=b.getElementsByTagName("i");b.innerHTML="\x3c!--[if gt IE "+ ++a+"]><i></i><![endif]--\x3e",c[0];);return 4<a?a:n}(),q=/\S+/g,t;return{Jc:["authenticity_token",/^__RequestVerificationToken(_.*)?$/],
D:function(a,b,c){for(var d=0,e=a.length;d<e;d++)b.call(c,a[d],d,a)},A:"function"==typeof Array.prototype.indexOf?function(a,b){return Array.prototype.indexOf.call(a,b)}:function(a,b){for(var c=0,d=a.length;c<d;c++)if(a[c]===b)return c;return-1},Lb:function(a,b,c){for(var d=0,e=a.length;d<e;d++)if(b.call(c,a[d],d,a))return a[d];return n},Pa:function(b,c){var d=a.a.A(b,c);0<d?b.splice(d,1):0===d&&b.shift()},wc:function(b){var c=[];b&&a.a.D(b,function(b){0>a.a.A(c,b)&&c.push(b)});return c},Mb:function(a,
b,c){var d=[];if(a)for(var e=0,l=a.length;e<l;e++)d.push(b.call(c,a[e],e));return d},jb:function(a,b,c){var d=[];if(a)for(var e=0,l=a.length;e<l;e++)b.call(c,a[e],e)&&d.push(a[e]);return d},Nb:function(a,b){if(b instanceof Array)a.push.apply(a,b);else for(var c=0,d=b.length;c<d;c++)a.push(b[c]);return a},Na:function(b,c,d){var e=a.a.A(a.a.bc(b),c);0>e?d&&b.push(c):d||b.splice(e,1)},Ba:g,extend:c,setPrototypeOf:d,Ab:g?d:c,P:b,Ga:function(a,b,c){if(!a)return a;var d={},e;for(e in a)f.call(a,e)&&(d[e]=
b.call(c,a[e],e,a));return d},Tb:function(b){for(;b.firstChild;)a.removeNode(b.firstChild)},Yb:function(b){b=a.a.la(b);for(var c=(b[0]&&b[0].ownerDocument||w).createElement("div"),d=0,e=b.length;d<e;d++)c.appendChild(a.oa(b[d]));return c},Ca:function(b,c){for(var d=0,e=b.length,l=[];d<e;d++){var k=b[d].cloneNode(!0);l.push(c?a.oa(k):k)}return l},va:function(b,c){a.a.Tb(b);if(c)for(var d=0,e=c.length;d<e;d++)b.appendChild(c[d])},Xc:function(b,c){var d=b.nodeType?[b]:b;if(0<d.length){for(var e=d[0],
l=e.parentNode,k=0,f=c.length;k<f;k++)l.insertBefore(c[k],e);k=0;for(f=d.length;k<f;k++)a.removeNode(d[k])}},Ua:function(a,b){if(a.length){for(b=8===b.nodeType&&b.parentNode||b;a.length&&a[0].parentNode!==b;)a.splice(0,1);for(;1<a.length&&a[a.length-1].parentNode!==b;)a.length--;if(1<a.length){var c=a[0],d=a[a.length-1];for(a.length=0;c!==d;)a.push(c),c=c.nextSibling;a.push(d)}}return a},Zc:function(a,b){7>p?a.setAttribute("selected",b):a.selected=b},Db:function(a){return null===a||a===n?"":a.trim?
a.trim():a.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},Ud:function(a,b){a=a||"";return b.length>a.length?!1:a.substring(0,b.length)===b},vd:function(a,b){if(a===b)return!0;if(11===a.nodeType)return!1;if(b.contains)return b.contains(1!==a.nodeType?a.parentNode:a);if(b.compareDocumentPosition)return 16==(b.compareDocumentPosition(a)&16);for(;a&&a!=b;)a=a.parentNode;return!!a},Sb:function(b){return a.a.vd(b,b.ownerDocument.documentElement)},kd:function(b){return!!a.a.Lb(b,a.a.Sb)},R:function(a){return a&&
a.tagName&&a.tagName.toLowerCase()},Ac:function(b){return a.onError?function(){try{return b.apply(this,arguments)}catch(c){throw a.onError&&a.onError(c),c;}}:b},setTimeout:function(b,c){return setTimeout(a.a.Ac(b),c)},Gc:function(b){setTimeout(function(){a.onError&&a.onError(b);throw b;},0)},B:function(b,c,d){var e=a.a.Ac(d);d=l[c];if(a.options.useOnlyNativeEvents||d||!v)if(d||"function"!=typeof b.addEventListener)if("undefined"!=typeof b.attachEvent){var k=function(a){e.call(b,a)},f="on"+c;b.attachEvent(f,
k);a.a.K.za(b,function(){b.detachEvent(f,k)})}else throw Error("Browser doesn't support addEventListener or attachEvent");else b.addEventListener(c,e,!1);else t||(t="function"==typeof v(b).on?"on":"bind"),v(b)[t](c,e)},Fb:function(b,c){if(!b||!b.nodeType)throw Error("element must be a DOM node when calling triggerEvent");var d;"input"===a.a.R(b)&&b.type&&"click"==c.toLowerCase()?(d=b.type,d="checkbox"==d||"radio"==d):d=!1;if(a.options.useOnlyNativeEvents||!v||d)if("function"==typeof w.createEvent)if("function"==
typeof b.dispatchEvent)d=w.createEvent(k[c]||"HTMLEvents"),d.initEvent(c,!0,!0,A,0,0,0,0,0,!1,!1,!1,!1,0,b),b.dispatchEvent(d);else throw Error("The supplied element doesn't support dispatchEvent");else if(d&&b.click)b.click();else if("undefined"!=typeof b.fireEvent)b.fireEvent("on"+c);else throw Error("Browser doesn't support triggering events");else v(b).trigger(c)},f:function(b){return a.O(b)?b():b},bc:function(b){return a.O(b)?b.v():b},Eb:function(b,c,d){var l;c&&("object"===typeof b.classList?
(l=b.classList[d?"add":"remove"],a.a.D(c.match(q),function(a){l.call(b.classList,a)})):"string"===typeof b.className.baseVal?e(b.className,"baseVal",c,d):e(b,"className",c,d))},Bb:function(b,c){var d=a.a.f(c);if(null===d||d===n)d="";var e=a.h.firstChild(b);!e||3!=e.nodeType||a.h.nextSibling(e)?a.h.va(b,[b.ownerDocument.createTextNode(d)]):e.data=d;a.a.Ad(b)},Yc:function(a,b){a.name=b;if(7>=p)try{var c=a.name.replace(/[&<>'"]/g,function(a){return"&#"+a.charCodeAt(0)+";"});a.mergeAttributes(w.createElement("<input name='"+
c+"'/>"),!1)}catch(d){}},Ad:function(a){9<=p&&(a=1==a.nodeType?a:a.parentNode,a.style&&(a.style.zoom=a.style.zoom))},wd:function(a){if(p){var b=a.style.width;a.style.width=0;a.style.width=b}},Pd:function(b,c){b=a.a.f(b);c=a.a.f(c);for(var d=[],e=b;e<=c;e++)d.push(e);return d},la:function(a){for(var b=[],c=0,d=a.length;c<d;c++)b.push(a[c]);return b},Da:function(a){return h?Symbol(a):a},Zd:6===p,$d:7===p,W:p,Lc:function(b,c){for(var d=a.a.la(b.getElementsByTagName("input")).concat(a.a.la(b.getElementsByTagName("textarea"))),
e="string"==typeof c?function(a){return a.name===c}:function(a){return c.test(a.name)},l=[],k=d.length-1;0<=k;k--)e(d[k])&&l.push(d[k]);return l},Nd:function(b){return"string"==typeof b&&(b=a.a.Db(b))?H&&H.parse?H.parse(b):(new Function("return "+b))():null},hc:function(b,c,d){if(!H||!H.stringify)throw Error("Cannot find JSON.stringify(). Some browsers (e.g., IE < 8) don't support it natively, but you can overcome this by adding a script reference to json2.js, downloadable from http://www.json.org/json2.js");
return H.stringify(a.a.f(b),c,d)},Od:function(c,d,e){e=e||{};var l=e.params||{},k=e.includeFields||this.Jc,f=c;if("object"==typeof c&&"form"===a.a.R(c))for(var f=c.action,h=k.length-1;0<=h;h--)for(var g=a.a.Lc(c,k[h]),m=g.length-1;0<=m;m--)l[g[m].name]=g[m].value;d=a.a.f(d);var p=w.createElement("form");p.style.display="none";p.action=f;p.method="post";for(var q in d)c=w.createElement("input"),c.type="hidden",c.name=q,c.value=a.a.hc(a.a.f(d[q])),p.appendChild(c);b(l,function(a,b){var c=w.createElement("input");
c.type="hidden";c.name=a;c.value=b;p.appendChild(c)});w.body.appendChild(p);e.submitter?e.submitter(p):p.submit();setTimeout(function(){p.parentNode.removeChild(p)},0)}}}();a.b("utils",a.a);a.b("utils.arrayForEach",a.a.D);a.b("utils.arrayFirst",a.a.Lb);a.b("utils.arrayFilter",a.a.jb);a.b("utils.arrayGetDistinctValues",a.a.wc);a.b("utils.arrayIndexOf",a.a.A);a.b("utils.arrayMap",a.a.Mb);a.b("utils.arrayPushAll",a.a.Nb);a.b("utils.arrayRemoveItem",a.a.Pa);a.b("utils.cloneNodes",a.a.Ca);a.b("utils.createSymbolOrString",
a.a.Da);a.b("utils.extend",a.a.extend);a.b("utils.fieldsIncludedWithJsonPost",a.a.Jc);a.b("utils.getFormFields",a.a.Lc);a.b("utils.objectMap",a.a.Ga);a.b("utils.peekObservable",a.a.bc);a.b("utils.postJson",a.a.Od);a.b("utils.parseJson",a.a.Nd);a.b("utils.registerEventHandler",a.a.B);a.b("utils.stringifyJson",a.a.hc);a.b("utils.range",a.a.Pd);a.b("utils.toggleDomNodeCssClass",a.a.Eb);a.b("utils.triggerEvent",a.a.Fb);a.b("utils.unwrapObservable",a.a.f);a.b("utils.objectForEach",a.a.P);a.b("utils.addOrRemoveItem",
a.a.Na);a.b("utils.setTextContent",a.a.Bb);a.b("unwrap",a.a.f);Function.prototype.bind||(Function.prototype.bind=function(a){var c=this;if(1===arguments.length)return function(){return c.apply(a,arguments)};var d=Array.prototype.slice.call(arguments,1);return function(){var e=d.slice(0);e.push.apply(e,arguments);return c.apply(a,e)}});a.a.g=new function(){var b=0,c="__ko__"+(new Date).getTime(),d={},e,f;a.a.W?(e=function(a,e){var f=a[c];if(!f||"null"===f||!d[f]){if(!e)return n;f=a[c]="ko"+b++;d[f]=
{}}return d[f]},f=function(a){var b=a[c];return b?(delete d[b],a[c]=null,!0):!1}):(e=function(a,b){var d=a[c];!d&&b&&(d=a[c]={});return d},f=function(a){return a[c]?(delete a[c],!0):!1});return{get:function(a,b){var c=e(a,!1);return c&&c[b]},set:function(a,b,c){(a=e(a,c!==n))&&(a[b]=c)},Ub:function(a,b,c){a=e(a,!0);return a[b]||(a[b]=c)},clear:f,Z:function(){return b++ +c}}};a.b("utils.domData",a.a.g);a.b("utils.domData.clear",a.a.g.clear);a.a.K=new function(){function b(b,c){var d=a.a.g.get(b,e);
d===n&&c&&(d=[],a.a.g.set(b,e,d));return d}function c(c){var e=b(c,!1);if(e)for(var e=e.slice(0),k=0;k<e.length;k++)e[k](c);a.a.g.clear(c);a.a.K.cleanExternalData(c);g[c.nodeType]&&d(c.childNodes,!0)}function d(b,d){for(var e=[],l,f=0;f<b.length;f++)if(!d||8===b[f].nodeType)if(c(e[e.length]=l=b[f]),b[f]!==l)for(;f--&&-1==a.a.A(e,b[f]););}var e=a.a.g.Z(),f={1:!0,8:!0,9:!0},g={1:!0,9:!0};return{za:function(a,c){if("function"!=typeof c)throw Error("Callback must be a function");b(a,!0).push(c)},yb:function(c,
d){var f=b(c,!1);f&&(a.a.Pa(f,d),0==f.length&&a.a.g.set(c,e,n))},oa:function(b){a.u.G(function(){f[b.nodeType]&&(c(b),g[b.nodeType]&&d(b.getElementsByTagName("*")))});return b},removeNode:function(b){a.oa(b);b.parentNode&&b.parentNode.removeChild(b)},cleanExternalData:function(a){v&&"function"==typeof v.cleanData&&v.cleanData([a])}}};a.oa=a.a.K.oa;a.removeNode=a.a.K.removeNode;a.b("cleanNode",a.oa);a.b("removeNode",a.removeNode);a.b("utils.domNodeDisposal",a.a.K);a.b("utils.domNodeDisposal.addDisposeCallback",
a.a.K.za);a.b("utils.domNodeDisposal.removeDisposeCallback",a.a.K.yb);(function(){var b=[0,"",""],c=[1,"<table>","</table>"],d=[3,"<table><tbody><tr>","</tr></tbody></table>"],e=[1,"<select multiple='multiple'>","</select>"],f={thead:c,tbody:c,tfoot:c,tr:[2,"<table><tbody>","</tbody></table>"],td:d,th:d,option:e,optgroup:e},g=8>=a.a.W;a.a.ua=function(c,d){var e;if(v)if(v.parseHTML)e=v.parseHTML(c,d)||[];else{if((e=v.clean([c],d))&&e[0]){for(var l=e[0];l.parentNode&&11!==l.parentNode.nodeType;)l=l.parentNode;
l.parentNode&&l.parentNode.removeChild(l)}}else{(e=d)||(e=w);var l=e.parentWindow||e.defaultView||A,p=a.a.Db(c).toLowerCase(),q=e.createElement("div"),t;t=(p=p.match(/^(?:\x3c!--.*?--\x3e\s*?)*?<([a-z]+)[\s>]/))&&f[p[1]]||b;p=t[0];t="ignored<div>"+t[1]+c+t[2]+"</div>";"function"==typeof l.innerShiv?q.appendChild(l.innerShiv(t)):(g&&e.body.appendChild(q),q.innerHTML=t,g&&q.parentNode.removeChild(q));for(;p--;)q=q.lastChild;e=a.a.la(q.lastChild.childNodes)}return e};a.a.Md=function(b,c){var d=a.a.ua(b,
c);return d.length&&d[0].parentElement||a.a.Yb(d)};a.a.fc=function(b,c){a.a.Tb(b);c=a.a.f(c);if(null!==c&&c!==n)if("string"!=typeof c&&(c=c.toString()),v)v(b).html(c);else for(var d=a.a.ua(c,b.ownerDocument),e=0;e<d.length;e++)b.appendChild(d[e])}})();a.b("utils.parseHtmlFragment",a.a.ua);a.b("utils.setHtml",a.a.fc);a.aa=function(){function b(c,e){if(c)if(8==c.nodeType){var f=a.aa.Uc(c.nodeValue);null!=f&&e.push({ud:c,Kd:f})}else if(1==c.nodeType)for(var f=0,g=c.childNodes,h=g.length;f<h;f++)b(g[f],
e)}var c={};return{Xb:function(a){if("function"!=typeof a)throw Error("You can only pass a function to ko.memoization.memoize()");var b=(4294967296*(1+Math.random())|0).toString(16).substring(1)+(4294967296*(1+Math.random())|0).toString(16).substring(1);c[b]=a;return"\x3c!--[ko_memo:"+b+"]--\x3e"},bd:function(a,b){var f=c[a];if(f===n)throw Error("Couldn't find any memo with ID "+a+". Perhaps it's already been unmemoized.");try{return f.apply(null,b||[]),!0}finally{delete c[a]}},cd:function(c,e){var f=
[];b(c,f);for(var g=0,h=f.length;g<h;g++){var m=f[g].ud,k=[m];e&&a.a.Nb(k,e);a.aa.bd(f[g].Kd,k);m.nodeValue="";m.parentNode&&m.parentNode.removeChild(m)}},Uc:function(a){return(a=a.match(/^\[ko_memo\:(.*?)\]$/))?a[1]:null}}}();a.b("memoization",a.aa);a.b("memoization.memoize",a.aa.Xb);a.b("memoization.unmemoize",a.aa.bd);a.b("memoization.parseMemoText",a.aa.Uc);a.b("memoization.unmemoizeDomNodeAndDescendants",a.aa.cd);a.na=function(){function b(){if(f)for(var b=f,c=0,d;h<f;)if(d=e[h++]){if(h>b){if(5E3<=
++c){h=f;a.a.Gc(Error("'Too much recursion' after processing "+c+" task groups."));break}b=f}try{d()}catch(p){a.a.Gc(p)}}}function c(){b();h=f=e.length=0}var d,e=[],f=0,g=1,h=0;A.MutationObserver?d=function(a){var b=w.createElement("div");(new MutationObserver(a)).observe(b,{attributes:!0});return function(){b.classList.toggle("foo")}}(c):d=w&&"onreadystatechange"in w.createElement("script")?function(a){var b=w.createElement("script");b.onreadystatechange=function(){b.onreadystatechange=null;w.documentElement.removeChild(b);
b=null;a()};w.documentElement.appendChild(b)}:function(a){setTimeout(a,0)};return{scheduler:d,zb:function(b){f||a.na.scheduler(c);e[f++]=b;return g++},cancel:function(a){a=a-(g-f);a>=h&&a<f&&(e[a]=null)},resetForTesting:function(){var a=f-h;h=f=e.length=0;return a},Sd:b}}();a.b("tasks",a.na);a.b("tasks.schedule",a.na.zb);a.b("tasks.runEarly",a.na.Sd);a.Ta={throttle:function(b,c){b.throttleEvaluation=c;var d=null;return a.$({read:b,write:function(e){clearTimeout(d);d=a.a.setTimeout(function(){b(e)},
c)}})},rateLimit:function(a,c){var d,e,f;"number"==typeof c?d=c:(d=c.timeout,e=c.method);a.Hb=!1;f="function"==typeof e?e:"notifyWhenChangesStop"==e?Y:X;a.ub(function(a){return f(a,d,c)})},deferred:function(b,c){if(!0!==c)throw Error("The 'deferred' extender only accepts the value 'true', because it is not supported to turn deferral off once enabled.");b.Hb||(b.Hb=!0,b.ub(function(c){var e,f=!1;return function(){if(!f){a.na.cancel(e);e=a.na.zb(c);try{f=!0,b.notifySubscribers(n,"dirty")}finally{f=
!1}}}}))},notify:function(a,c){a.equalityComparer="always"==c?null:K}};var W={undefined:1,"boolean":1,number:1,string:1};a.b("extenders",a.Ta);a.ic=function(b,c,d){this.da=b;this.lc=c;this.mc=d;this.Ib=!1;this.fb=this.Jb=null;a.L(this,"dispose",this.s);a.L(this,"disposeWhenNodeIsRemoved",this.l)};a.ic.prototype.s=function(){this.Ib||(this.fb&&a.a.K.yb(this.Jb,this.fb),this.Ib=!0,this.mc(),this.da=this.lc=this.mc=this.Jb=this.fb=null)};a.ic.prototype.l=function(b){this.Jb=b;a.a.K.za(b,this.fb=this.s.bind(this))};
a.T=function(){a.a.Ab(this,D);D.qb(this)};var D={qb:function(a){a.U={change:[]};a.sc=1},subscribe:function(b,c,d){var e=this;d=d||"change";var f=new a.ic(e,c?b.bind(c):b,function(){a.a.Pa(e.U[d],f);e.hb&&e.hb(d)});e.Qa&&e.Qa(d);e.U[d]||(e.U[d]=[]);e.U[d].push(f);return f},notifySubscribers:function(b,c){c=c||"change";"change"===c&&this.Gb();if(this.Wa(c)){var d="change"===c&&this.ed||this.U[c].slice(0);try{a.u.xc();for(var e=0,f;f=d[e];++e)f.Ib||f.lc(b)}finally{a.u.end()}}},ob:function(){return this.sc},
Dd:function(a){return this.ob()!==a},Gb:function(){++this.sc},ub:function(b){var c=this,d=a.O(c),e,f,g,h,m;c.gb||(c.gb=c.notifySubscribers,c.notifySubscribers=Z);var k=b(function(){c.Ja=!1;d&&h===c&&(h=c.nc?c.nc():c());var a=f||m&&c.sb(g,h);m=f=e=!1;a&&c.gb(g=h)});c.qc=function(a,b){b&&c.Ja||(m=!b);c.ed=c.U.change.slice(0);c.Ja=e=!0;h=a;k()};c.pc=function(a){e||(g=a,c.gb(a,"beforeChange"))};c.rc=function(){m=!0};c.gd=function(){c.sb(g,c.v(!0))&&(f=!0)}},Wa:function(a){return this.U[a]&&this.U[a].length},
Bd:function(b){if(b)return this.U[b]&&this.U[b].length||0;var c=0;a.a.P(this.U,function(a,b){"dirty"!==a&&(c+=b.length)});return c},sb:function(a,c){return!this.equalityComparer||!this.equalityComparer(a,c)},toString:function(){return"[object Object]"},extend:function(b){var c=this;b&&a.a.P(b,function(b,e){var f=a.Ta[b];"function"==typeof f&&(c=f(c,e)||c)});return c}};a.L(D,"init",D.qb);a.L(D,"subscribe",D.subscribe);a.L(D,"extend",D.extend);a.L(D,"getSubscriptionsCount",D.Bd);a.a.Ba&&a.a.setPrototypeOf(D,
Function.prototype);a.T.fn=D;a.Qc=function(a){return null!=a&&"function"==typeof a.subscribe&&"function"==typeof a.notifySubscribers};a.b("subscribable",a.T);a.b("isSubscribable",a.Qc);a.S=a.u=function(){function b(a){d.push(e);e=a}function c(){e=d.pop()}var d=[],e,f=0;return{xc:b,end:c,cc:function(b){if(e){if(!a.Qc(b))throw Error("Only subscribable things can act as dependencies");e.od.call(e.pd,b,b.fd||(b.fd=++f))}},G:function(a,d,e){try{return b(),a.apply(d,e||[])}finally{c()}},qa:function(){if(e)return e.o.qa()},
Va:function(){if(e)return e.o.Va()},Ya:function(){if(e)return e.Ya},o:function(){if(e)return e.o}}}();a.b("computedContext",a.S);a.b("computedContext.getDependenciesCount",a.S.qa);a.b("computedContext.getDependencies",a.S.Va);a.b("computedContext.isInitial",a.S.Ya);a.b("computedContext.registerDependency",a.S.cc);a.b("ignoreDependencies",a.Yd=a.u.G);var I=a.a.Da("_latestValue");a.ta=function(b){function c(){if(0<arguments.length)return c.sb(c[I],arguments[0])&&(c.ya(),c[I]=arguments[0],c.xa()),this;
a.u.cc(c);return c[I]}c[I]=b;a.a.Ba||a.a.extend(c,a.T.fn);a.T.fn.qb(c);a.a.Ab(c,F);a.options.deferUpdates&&a.Ta.deferred(c,!0);return c};var F={equalityComparer:K,v:function(){return this[I]},xa:function(){this.notifySubscribers(this[I],"spectate");this.notifySubscribers(this[I])},ya:function(){this.notifySubscribers(this[I],"beforeChange")}};a.a.Ba&&a.a.setPrototypeOf(F,a.T.fn);var G=a.ta.Ma="__ko_proto__";F[G]=a.ta;a.O=function(b){if((b="function"==typeof b&&b[G])&&b!==F[G]&&b!==a.o.fn[G])throw Error("Invalid object that looks like an observable; possibly from another Knockout instance");
return!!b};a.Za=function(b){return"function"==typeof b&&(b[G]===F[G]||b[G]===a.o.fn[G]&&b.Nc)};a.b("observable",a.ta);a.b("isObservable",a.O);a.b("isWriteableObservable",a.Za);a.b("isWritableObservable",a.Za);a.b("observable.fn",F);a.L(F,"peek",F.v);a.L(F,"valueHasMutated",F.xa);a.L(F,"valueWillMutate",F.ya);a.Ha=function(b){b=b||[];if("object"!=typeof b||!("length"in b))throw Error("The argument passed when initializing an observable array must be an array, or null, or undefined.");b=a.ta(b);a.a.Ab(b,
a.Ha.fn);return b.extend({trackArrayChanges:!0})};a.Ha.fn={remove:function(b){for(var c=this.v(),d=[],e="function"!=typeof b||a.O(b)?function(a){return a===b}:b,f=0;f<c.length;f++){var g=c[f];if(e(g)){0===d.length&&this.ya();if(c[f]!==g)throw Error("Array modified during remove; cannot remove item");d.push(g);c.splice(f,1);f--}}d.length&&this.xa();return d},removeAll:function(b){if(b===n){var c=this.v(),d=c.slice(0);this.ya();c.splice(0,c.length);this.xa();return d}return b?this.remove(function(c){return 0<=
a.a.A(b,c)}):[]},destroy:function(b){var c=this.v(),d="function"!=typeof b||a.O(b)?function(a){return a===b}:b;this.ya();for(var e=c.length-1;0<=e;e--){var f=c[e];d(f)&&(f._destroy=!0)}this.xa()},destroyAll:function(b){return b===n?this.destroy(function(){return!0}):b?this.destroy(function(c){return 0<=a.a.A(b,c)}):[]},indexOf:function(b){var c=this();return a.a.A(c,b)},replace:function(a,c){var d=this.indexOf(a);0<=d&&(this.ya(),this.v()[d]=c,this.xa())},sorted:function(a){var c=this().slice(0);
return a?c.sort(a):c.sort()},reversed:function(){return this().slice(0).reverse()}};a.a.Ba&&a.a.setPrototypeOf(a.Ha.fn,a.ta.fn);a.a.D("pop push reverse shift sort splice unshift".split(" "),function(b){a.Ha.fn[b]=function(){var a=this.v();this.ya();this.zc(a,b,arguments);var d=a[b].apply(a,arguments);this.xa();return d===a?this:d}});a.a.D(["slice"],function(b){a.Ha.fn[b]=function(){var a=this();return a[b].apply(a,arguments)}});a.Pc=function(b){return a.O(b)&&"function"==typeof b.remove&&"function"==
typeof b.push};a.b("observableArray",a.Ha);a.b("isObservableArray",a.Pc);a.Ta.trackArrayChanges=function(b,c){function d(){function c(){if(m){var d=[].concat(b.v()||[]),e;if(b.Wa("arrayChange")){if(!f||1<m)f=a.a.Pb(k,d,b.Ob);e=f}k=d;f=null;m=0;e&&e.length&&b.notifySubscribers(e,"arrayChange")}}e?c():(e=!0,h=b.subscribe(function(){++m},null,"spectate"),k=[].concat(b.v()||[]),f=null,g=b.subscribe(c))}b.Ob={};c&&"object"==typeof c&&a.a.extend(b.Ob,c);b.Ob.sparse=!0;if(!b.zc){var e=!1,f=null,g,h,m=0,
k,l=b.Qa,p=b.hb;b.Qa=function(a){l&&l.call(b,a);"arrayChange"===a&&d()};b.hb=function(a){p&&p.call(b,a);"arrayChange"!==a||b.Wa("arrayChange")||(g&&g.s(),h&&h.s(),h=g=null,e=!1,k=n)};b.zc=function(b,c,d){function l(a,b,c){return k[k.length]={status:a,value:b,index:c}}if(e&&!m){var k=[],p=b.length,g=d.length,h=0;switch(c){case "push":h=p;case "unshift":for(c=0;c<g;c++)l("added",d[c],h+c);break;case "pop":h=p-1;case "shift":p&&l("deleted",b[h],h);break;case "splice":c=Math.min(Math.max(0,0>d[0]?p+d[0]:
d[0]),p);for(var p=1===g?p:Math.min(c+(d[1]||0),p),g=c+g-2,h=Math.max(p,g),U=[],L=[],n=2;c<h;++c,++n)c<p&&L.push(l("deleted",b[c],c)),c<g&&U.push(l("added",d[n],c));a.a.Kc(L,U);break;default:return}f=k}}}};var r=a.a.Da("_state");a.o=a.$=function(b,c,d){function e(){if(0<arguments.length){if("function"===typeof f)f.apply(g.nb,arguments);else throw Error("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.");return this}g.ra||
a.u.cc(e);(g.ka||g.J&&e.Xa())&&e.ha();return g.X}"object"===typeof b?d=b:(d=d||{},b&&(d.read=b));if("function"!=typeof d.read)throw Error("Pass a function that returns the value of the ko.computed");var f=d.write,g={X:n,sa:!0,ka:!0,rb:!1,jc:!1,ra:!1,wb:!1,J:!1,Wc:d.read,nb:c||d.owner,l:d.disposeWhenNodeIsRemoved||d.l||null,Sa:d.disposeWhen||d.Sa,Rb:null,I:{},V:0,Ic:null};e[r]=g;e.Nc="function"===typeof f;a.a.Ba||a.a.extend(e,a.T.fn);a.T.fn.qb(e);a.a.Ab(e,C);d.pure?(g.wb=!0,g.J=!0,a.a.extend(e,da)):
d.deferEvaluation&&a.a.extend(e,ea);a.options.deferUpdates&&a.Ta.deferred(e,!0);g.l&&(g.jc=!0,g.l.nodeType||(g.l=null));g.J||d.deferEvaluation||e.ha();g.l&&e.ja()&&a.a.K.za(g.l,g.Rb=function(){e.s()});return e};var C={equalityComparer:K,qa:function(){return this[r].V},Va:function(){var b=[];a.a.P(this[r].I,function(a,d){b[d.Ka]=d.da});return b},Vb:function(b){if(!this[r].V)return!1;var c=this.Va();return-1!==a.a.A(c,b)?!0:!!a.a.Lb(c,function(a){return a.Vb&&a.Vb(b)})},uc:function(a,c,d){if(this[r].wb&&
c===this)throw Error("A 'pure' computed must not be called recursively");this[r].I[a]=d;d.Ka=this[r].V++;d.La=c.ob()},Xa:function(){var a,c,d=this[r].I;for(a in d)if(Object.prototype.hasOwnProperty.call(d,a)&&(c=d[a],this.Ia&&c.da.Ja||c.da.Dd(c.La)))return!0},Jd:function(){this.Ia&&!this[r].rb&&this.Ia(!1)},ja:function(){var a=this[r];return a.ka||0<a.V},Rd:function(){this.Ja?this[r].ka&&(this[r].sa=!0):this.Hc()},$c:function(a){if(a.Hb){var c=a.subscribe(this.Jd,this,"dirty"),d=a.subscribe(this.Rd,
this);return{da:a,s:function(){c.s();d.s()}}}return a.subscribe(this.Hc,this)},Hc:function(){var b=this,c=b.throttleEvaluation;c&&0<=c?(clearTimeout(this[r].Ic),this[r].Ic=a.a.setTimeout(function(){b.ha(!0)},c)):b.Ia?b.Ia(!0):b.ha(!0)},ha:function(b){var c=this[r],d=c.Sa,e=!1;if(!c.rb&&!c.ra){if(c.l&&!a.a.Sb(c.l)||d&&d()){if(!c.jc){this.s();return}}else c.jc=!1;c.rb=!0;try{e=this.zd(b)}finally{c.rb=!1}return e}},zd:function(b){var c=this[r],d=!1,e=c.wb?n:!c.V,d={qd:this,mb:c.I,Qb:c.V};a.u.xc({pd:d,
od:ba,o:this,Ya:e});c.I={};c.V=0;var f=this.yd(c,d);c.V?d=this.sb(c.X,f):(this.s(),d=!0);d&&(c.J?this.Gb():this.notifySubscribers(c.X,"beforeChange"),c.X=f,this.notifySubscribers(c.X,"spectate"),!c.J&&b&&this.notifySubscribers(c.X),this.rc&&this.rc());e&&this.notifySubscribers(c.X,"awake");return d},yd:function(b,c){try{var d=b.Wc;return b.nb?d.call(b.nb):d()}finally{a.u.end(),c.Qb&&!b.J&&a.a.P(c.mb,aa),b.sa=b.ka=!1}},v:function(a){var c=this[r];(c.ka&&(a||!c.V)||c.J&&this.Xa())&&this.ha();return c.X},
ub:function(b){a.T.fn.ub.call(this,b);this.nc=function(){this[r].J||(this[r].sa?this.ha():this[r].ka=!1);return this[r].X};this.Ia=function(a){this.pc(this[r].X);this[r].ka=!0;a&&(this[r].sa=!0);this.qc(this,!a)}},s:function(){var b=this[r];!b.J&&b.I&&a.a.P(b.I,function(a,b){b.s&&b.s()});b.l&&b.Rb&&a.a.K.yb(b.l,b.Rb);b.I=n;b.V=0;b.ra=!0;b.sa=!1;b.ka=!1;b.J=!1;b.l=n;b.Sa=n;b.Wc=n;this.Nc||(b.nb=n)}},da={Qa:function(b){var c=this,d=c[r];if(!d.ra&&d.J&&"change"==b){d.J=!1;if(d.sa||c.Xa())d.I=null,d.V=
0,c.ha()&&c.Gb();else{var e=[];a.a.P(d.I,function(a,b){e[b.Ka]=a});a.a.D(e,function(a,b){var e=d.I[a],m=c.$c(e.da);m.Ka=b;m.La=e.La;d.I[a]=m});c.Xa()&&c.ha()&&c.Gb()}d.ra||c.notifySubscribers(d.X,"awake")}},hb:function(b){var c=this[r];c.ra||"change"!=b||this.Wa("change")||(a.a.P(c.I,function(a,b){b.s&&(c.I[a]={da:b.da,Ka:b.Ka,La:b.La},b.s())}),c.J=!0,this.notifySubscribers(n,"asleep"))},ob:function(){var b=this[r];b.J&&(b.sa||this.Xa())&&this.ha();return a.T.fn.ob.call(this)}},ea={Qa:function(a){"change"!=
a&&"beforeChange"!=a||this.v()}};a.a.Ba&&a.a.setPrototypeOf(C,a.T.fn);var N=a.ta.Ma;C[N]=a.o;a.Oc=function(a){return"function"==typeof a&&a[N]===C[N]};a.Fd=function(b){return a.Oc(b)&&b[r]&&b[r].wb};a.b("computed",a.o);a.b("dependentObservable",a.o);a.b("isComputed",a.Oc);a.b("isPureComputed",a.Fd);a.b("computed.fn",C);a.L(C,"peek",C.v);a.L(C,"dispose",C.s);a.L(C,"isActive",C.ja);a.L(C,"getDependenciesCount",C.qa);a.L(C,"getDependencies",C.Va);a.xb=function(b,c){if("function"===typeof b)return a.o(b,
c,{pure:!0});b=a.a.extend({},b);b.pure=!0;return a.o(b,c)};a.b("pureComputed",a.xb);(function(){function b(a,f,g){g=g||new d;a=f(a);if("object"!=typeof a||null===a||a===n||a instanceof RegExp||a instanceof Date||a instanceof String||a instanceof Number||a instanceof Boolean)return a;var h=a instanceof Array?[]:{};g.save(a,h);c(a,function(c){var d=f(a[c]);switch(typeof d){case "boolean":case "number":case "string":case "function":h[c]=d;break;case "object":case "undefined":var l=g.get(d);h[c]=l!==
n?l:b(d,f,g)}});return h}function c(a,b){if(a instanceof Array){for(var c=0;c<a.length;c++)b(c);"function"==typeof a.toJSON&&b("toJSON")}else for(c in a)b(c)}function d(){this.keys=[];this.values=[]}a.ad=function(c){if(0==arguments.length)throw Error("When calling ko.toJS, pass the object you want to convert.");return b(c,function(b){for(var c=0;a.O(b)&&10>c;c++)b=b();return b})};a.toJSON=function(b,c,d){b=a.ad(b);return a.a.hc(b,c,d)};d.prototype={constructor:d,save:function(b,c){var d=a.a.A(this.keys,
b);0<=d?this.values[d]=c:(this.keys.push(b),this.values.push(c))},get:function(b){b=a.a.A(this.keys,b);return 0<=b?this.values[b]:n}}})();a.b("toJS",a.ad);a.b("toJSON",a.toJSON);a.Wd=function(b,c,d){function e(c){var e=a.xb(b,d).extend({ma:"always"}),h=e.subscribe(function(a){a&&(h.s(),c(a))});e.notifySubscribers(e.v());return h}return"function"!==typeof Promise||c?e(c.bind(d)):new Promise(e)};a.b("when",a.Wd);(function(){a.w={M:function(b){switch(a.a.R(b)){case "option":return!0===b.__ko__hasDomDataOptionValue__?
a.a.g.get(b,a.c.options.$b):7>=a.a.W?b.getAttributeNode("value")&&b.getAttributeNode("value").specified?b.value:b.text:b.value;case "select":return 0<=b.selectedIndex?a.w.M(b.options[b.selectedIndex]):n;default:return b.value}},cb:function(b,c,d){switch(a.a.R(b)){case "option":"string"===typeof c?(a.a.g.set(b,a.c.options.$b,n),"__ko__hasDomDataOptionValue__"in b&&delete b.__ko__hasDomDataOptionValue__,b.value=c):(a.a.g.set(b,a.c.options.$b,c),b.__ko__hasDomDataOptionValue__=!0,b.value="number"===
typeof c?c:"");break;case "select":if(""===c||null===c)c=n;for(var e=-1,f=0,g=b.options.length,h;f<g;++f)if(h=a.w.M(b.options[f]),h==c||""===h&&c===n){e=f;break}if(d||0<=e||c===n&&1<b.size)b.selectedIndex=e,6===a.a.W&&a.a.setTimeout(function(){b.selectedIndex=e},0);break;default:if(null===c||c===n)c="";b.value=c}}}})();a.b("selectExtensions",a.w);a.b("selectExtensions.readValue",a.w.M);a.b("selectExtensions.writeValue",a.w.cb);a.m=function(){function b(b){b=a.a.Db(b);123===b.charCodeAt(0)&&(b=b.slice(1,
-1));b+="\n,";var c=[],d=b.match(e),p,q=[],h=0;if(1<d.length){for(var x=0,B;B=d[x];++x){var u=B.charCodeAt(0);if(44===u){if(0>=h){c.push(p&&q.length?{key:p,value:q.join("")}:{unknown:p||q.join("")});p=h=0;q=[];continue}}else if(58===u){if(!h&&!p&&1===q.length){p=q.pop();continue}}else if(47===u&&1<B.length&&(47===B.charCodeAt(1)||42===B.charCodeAt(1)))continue;else 47===u&&x&&1<B.length?(u=d[x-1].match(f))&&!g[u[0]]&&(b=b.substr(b.indexOf(B)+1),d=b.match(e),x=-1,B="/"):40===u||123===u||91===u?++h:
41===u||125===u||93===u?--h:p||q.length||34!==u&&39!==u||(B=B.slice(1,-1));q.push(B)}if(0<h)throw Error("Unbalanced parentheses, braces, or brackets");}return c}var c=["true","false","null","undefined"],d=/^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i,e=RegExp("\"(?:\\\\.|[^\"])*\"|'(?:\\\\.|[^'])*'|`(?:\\\\.|[^`])*`|/\\*(?:[^*]|\\*+[^*/])*\\*+/|//.*\n|/(?:\\\\.|[^/])+/w*|[^\\s:,/][^,\"'`{}()/:[\\]]*[^\\s,\"'`{}()/:[\\]]|[^\\s]","g"),f=/[\])"'A-Za-z0-9_$]+$/,g={"in":1,"return":1,"typeof":1},
h={};return{Ra:[],wa:h,ac:b,vb:function(e,f){function l(b,e){var f;if(!x){var k=a.getBindingHandler(b);if(k&&k.preprocess&&!(e=k.preprocess(e,b,l)))return;if(k=h[b])f=e,0<=a.a.A(c,f)?f=!1:(k=f.match(d),f=null===k?!1:k[1]?"Object("+k[1]+")"+k[2]:f),k=f;k&&q.push("'"+("string"==typeof h[b]?h[b]:b)+"':function(_z){"+f+"=_z}")}g&&(e="function(){return "+e+" }");p.push("'"+b+"':"+e)}f=f||{};var p=[],q=[],g=f.valueAccessors,x=f.bindingParams,B="string"===typeof e?b(e):e;a.a.D(B,function(a){l(a.key||a.unknown,
a.value)});q.length&&l("_ko_property_writers","{"+q.join(",")+" }");return p.join(",")},Id:function(a,b){for(var c=0;c<a.length;c++)if(a[c].key==b)return!0;return!1},eb:function(b,c,d,e,f){if(b&&a.O(b))!a.Za(b)||f&&b.v()===e||b(e);else if((b=c.get("_ko_property_writers"))&&b[d])b[d](e)}}}();a.b("expressionRewriting",a.m);a.b("expressionRewriting.bindingRewriteValidators",a.m.Ra);a.b("expressionRewriting.parseObjectLiteral",a.m.ac);a.b("expressionRewriting.preProcessBindings",a.m.vb);a.b("expressionRewriting._twoWayBindings",
a.m.wa);a.b("jsonExpressionRewriting",a.m);a.b("jsonExpressionRewriting.insertPropertyAccessorsIntoJson",a.m.vb);(function(){function b(a){return 8==a.nodeType&&g.test(f?a.text:a.nodeValue)}function c(a){return 8==a.nodeType&&h.test(f?a.text:a.nodeValue)}function d(d,e){for(var f=d,h=1,g=[];f=f.nextSibling;){if(c(f)&&(a.a.g.set(f,k,!0),h--,0===h))return g;g.push(f);b(f)&&h++}if(!e)throw Error("Cannot find closing comment tag to match: "+d.nodeValue);return null}function e(a,b){var c=d(a,b);return c?
0<c.length?c[c.length-1].nextSibling:a.nextSibling:null}var f=w&&"\x3c!--test--\x3e"===w.createComment("test").text,g=f?/^\x3c!--\s*ko(?:\s+([\s\S]+))?\s*--\x3e$/:/^\s*ko(?:\s+([\s\S]+))?\s*$/,h=f?/^\x3c!--\s*\/ko\s*--\x3e$/:/^\s*\/ko\s*$/,m={ul:!0,ol:!0},k="__ko_matchedEndComment__";a.h={ea:{},childNodes:function(a){return b(a)?d(a):a.childNodes},Ea:function(c){if(b(c)){c=a.h.childNodes(c);for(var d=0,e=c.length;d<e;d++)a.removeNode(c[d])}else a.a.Tb(c)},va:function(c,d){if(b(c)){a.h.Ea(c);for(var e=
c.nextSibling,f=0,k=d.length;f<k;f++)e.parentNode.insertBefore(d[f],e)}else a.a.va(c,d)},Vc:function(a,c){var d;b(a)?(d=a.nextSibling,a=a.parentNode):d=a.firstChild;d?c!==d&&a.insertBefore(c,d):a.appendChild(c)},Wb:function(c,d,e){e?(e=e.nextSibling,b(c)&&(c=c.parentNode),e?d!==e&&c.insertBefore(d,e):c.appendChild(d)):a.h.Vc(c,d)},firstChild:function(a){if(b(a))return!a.nextSibling||c(a.nextSibling)?null:a.nextSibling;if(a.firstChild&&c(a.firstChild))throw Error("Found invalid end comment, as the first child of "+
a);return a.firstChild},nextSibling:function(d){b(d)&&(d=e(d));if(d.nextSibling&&c(d.nextSibling)){var f=d.nextSibling;if(c(f)&&!a.a.g.get(f,k))throw Error("Found end comment without a matching opening comment, as child of "+d);return null}return d.nextSibling},Cd:b,Vd:function(a){return(a=(f?a.text:a.nodeValue).match(g))?a[1]:null},Sc:function(d){if(m[a.a.R(d)]){var f=d.firstChild;if(f){do if(1===f.nodeType){var k;k=f.firstChild;var h=null;if(k){do if(h)h.push(k);else if(b(k)){var g=e(k,!0);g?k=
g:h=[k]}else c(k)&&(h=[k]);while(k=k.nextSibling)}if(k=h)for(h=f.nextSibling,g=0;g<k.length;g++)h?d.insertBefore(k[g],h):d.appendChild(k[g])}while(f=f.nextSibling)}}}}})();a.b("virtualElements",a.h);a.b("virtualElements.allowedBindings",a.h.ea);a.b("virtualElements.emptyNode",a.h.Ea);a.b("virtualElements.insertAfter",a.h.Wb);a.b("virtualElements.prepend",a.h.Vc);a.b("virtualElements.setDomNodeChildren",a.h.va);(function(){a.ga=function(){this.nd={}};a.a.extend(a.ga.prototype,{nodeHasBindings:function(b){switch(b.nodeType){case 1:return null!=
b.getAttribute("data-bind")||a.j.getComponentNameForNode(b);case 8:return a.h.Cd(b);default:return!1}},getBindings:function(b,c){var d=this.getBindingsString(b,c),d=d?this.parseBindingsString(d,c,b):null;return a.j.tc(d,b,c,!1)},getBindingAccessors:function(b,c){var d=this.getBindingsString(b,c),d=d?this.parseBindingsString(d,c,b,{valueAccessors:!0}):null;return a.j.tc(d,b,c,!0)},getBindingsString:function(b){switch(b.nodeType){case 1:return b.getAttribute("data-bind");case 8:return a.h.Vd(b);default:return null}},
parseBindingsString:function(b,c,d,e){try{var f=this.nd,g=b+(e&&e.valueAccessors||""),h;if(!(h=f[g])){var m,k="with($context){with($data||{}){return{"+a.m.vb(b,e)+"}}}";m=new Function("$context","$element",k);h=f[g]=m}return h(c,d)}catch(l){throw l.message="Unable to parse bindings.\nBindings value: "+b+"\nMessage: "+l.message,l;}}});a.ga.instance=new a.ga})();a.b("bindingProvider",a.ga);(function(){function b(b){var c=(b=a.a.g.get(b,z))&&b.N;c&&(b.N=null,c.Tc())}function c(c,d,e){this.node=c;this.yc=
d;this.kb=[];this.H=!1;d.N||a.a.K.za(c,b);e&&e.N&&(e.N.kb.push(c),this.Kb=e)}function d(a){return function(){return a}}function e(a){return a()}function f(b){return a.a.Ga(a.u.G(b),function(a,c){return function(){return b()[c]}})}function g(b,c,e){return"function"===typeof b?f(b.bind(null,c,e)):a.a.Ga(b,d)}function h(a,b){return f(this.getBindings.bind(this,a,b))}function m(b,c){var d=a.h.firstChild(c);if(d){var e,f=a.ga.instance,l=f.preprocessNode;if(l){for(;e=d;)d=a.h.nextSibling(e),l.call(f,e);
d=a.h.firstChild(c)}for(;e=d;)d=a.h.nextSibling(e),k(b,e)}a.i.ma(c,a.i.H)}function k(b,c){var d=b,e=1===c.nodeType;e&&a.h.Sc(c);if(e||a.ga.instance.nodeHasBindings(c))d=p(c,null,b).bindingContextForDescendants;d&&!u[a.a.R(c)]&&m(d,c)}function l(b){var c=[],d={},e=[];a.a.P(b,function ca(f){if(!d[f]){var k=a.getBindingHandler(f);k&&(k.after&&(e.push(f),a.a.D(k.after,function(c){if(b[c]){if(-1!==a.a.A(e,c))throw Error("Cannot combine the following bindings, because they have a cyclic dependency: "+e.join(", "));
ca(c)}}),e.length--),c.push({key:f,Mc:k}));d[f]=!0}});return c}function p(b,c,d){var f=a.a.g.Ub(b,z,{}),k=f.hd;if(!c){if(k)throw Error("You cannot apply bindings multiple times to the same element.");f.hd=!0}k||(f.context=d);f.Zb||(f.Zb={});var g;if(c&&"function"!==typeof c)g=c;else{var p=a.ga.instance,q=p.getBindingAccessors||h,m=a.$(function(){if(g=c?c(d,b):q.call(p,b,d)){if(d[t])d[t]();if(d[B])d[B]()}return g},null,{l:b});g&&m.ja()||(m=null)}var x=d,u;if(g){var J=function(){return a.a.Ga(m?m():
g,e)},r=m?function(a){return function(){return e(m()[a])}}:function(a){return g[a]};J.get=function(a){return g[a]&&e(r(a))};J.has=function(a){return a in g};a.i.H in g&&a.i.subscribe(b,a.i.H,function(){var c=(0,g[a.i.H])();if(c){var d=a.h.childNodes(b);d.length&&c(d,a.Ec(d[0]))}});a.i.pa in g&&(x=a.i.Cb(b,d),a.i.subscribe(b,a.i.pa,function(){var c=(0,g[a.i.pa])();c&&a.h.firstChild(b)&&c(b)}));f=l(g);a.a.D(f,function(c){var d=c.Mc.init,e=c.Mc.update,f=c.key;if(8===b.nodeType&&!a.h.ea[f])throw Error("The binding '"+
f+"' cannot be used with virtual elements");try{"function"==typeof d&&a.u.G(function(){var a=d(b,r(f),J,x.$data,x);if(a&&a.controlsDescendantBindings){if(u!==n)throw Error("Multiple bindings ("+u+" and "+f+") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.");u=f}}),"function"==typeof e&&a.$(function(){e(b,r(f),J,x.$data,x)},null,{l:b})}catch(k){throw k.message='Unable to process binding "'+f+": "+g[f]+'"\nMessage: '+k.message,
k;}})}f=u===n;return{shouldBindDescendants:f,bindingContextForDescendants:f&&x}}function q(b,c){return b&&b instanceof a.fa?b:new a.fa(b,n,n,c)}var t=a.a.Da("_subscribable"),x=a.a.Da("_ancestorBindingInfo"),B=a.a.Da("_dataDependency");a.c={};var u={script:!0,textarea:!0,template:!0};a.getBindingHandler=function(b){return a.c[b]};var J={};a.fa=function(b,c,d,e,f){function k(){var b=p?h():h,f=a.a.f(b);c?(a.a.extend(l,c),x in c&&(l[x]=c[x])):(l.$parents=[],l.$root=f,l.ko=a);l[t]=q;g?f=l.$data:(l.$rawData=
b,l.$data=f);d&&(l[d]=f);e&&e(l,c,f);if(c&&c[t]&&!a.S.o().Vb(c[t]))c[t]();m&&(l[B]=m);return l.$data}var l=this,g=b===J,h=g?n:b,p="function"==typeof h&&!a.O(h),q,m=f&&f.dataDependency;f&&f.exportDependencies?k():(q=a.xb(k),q.v(),q.ja()?q.equalityComparer=null:l[t]=n)};a.fa.prototype.createChildContext=function(b,c,d,e){!e&&c&&"object"==typeof c&&(e=c,c=e.as,d=e.extend);if(c&&e&&e.noChildContext){var f="function"==typeof b&&!a.O(b);return new a.fa(J,this,null,function(a){d&&d(a);a[c]=f?b():b},e)}return new a.fa(b,
this,c,function(a,b){a.$parentContext=b;a.$parent=b.$data;a.$parents=(b.$parents||[]).slice(0);a.$parents.unshift(a.$parent);d&&d(a)},e)};a.fa.prototype.extend=function(b,c){return new a.fa(J,this,null,function(c){a.a.extend(c,"function"==typeof b?b(c):b)},c)};var z=a.a.g.Z();c.prototype.Tc=function(){this.Kb&&this.Kb.N&&this.Kb.N.sd(this.node)};c.prototype.sd=function(b){a.a.Pa(this.kb,b);!this.kb.length&&this.H&&this.Cc()};c.prototype.Cc=function(){this.H=!0;this.yc.N&&!this.kb.length&&(this.yc.N=
null,a.a.K.yb(this.node,b),a.i.ma(this.node,a.i.pa),this.Tc())};a.i={H:"childrenComplete",pa:"descendantsComplete",subscribe:function(b,c,d,e,f){var k=a.a.g.Ub(b,z,{});k.Fa||(k.Fa=new a.T);f&&f.notifyImmediately&&k.Zb[c]&&a.u.G(d,e,[b]);return k.Fa.subscribe(d,e,c)},ma:function(b,c){var d=a.a.g.get(b,z);if(d&&(d.Zb[c]=!0,d.Fa&&d.Fa.notifySubscribers(b,c),c==a.i.H))if(d.N)d.N.Cc();else if(d.N===n&&d.Fa&&d.Fa.Wa(a.i.pa))throw Error("descendantsComplete event not supported for bindings on this node");
},Cb:function(b,d){var e=a.a.g.Ub(b,z,{});e.N||(e.N=new c(b,e,d[x]));return d[x]==e?d:d.extend(function(a){a[x]=e})}};a.Td=function(b){return(b=a.a.g.get(b,z))&&b.context};a.ib=function(b,c,d){1===b.nodeType&&a.h.Sc(b);return p(b,c,q(d))};a.ld=function(b,c,d){d=q(d);return a.ib(b,g(c,d,b),d)};a.Oa=function(a,b){1!==b.nodeType&&8!==b.nodeType||m(q(a),b)};a.vc=function(a,b,c){!v&&A.jQuery&&(v=A.jQuery);if(2>arguments.length){if(b=w.body,!b)throw Error("ko.applyBindings: could not find document.body; has the document been loaded?");
}else if(!b||1!==b.nodeType&&8!==b.nodeType)throw Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node");k(q(a,c),b)};a.Dc=function(b){return!b||1!==b.nodeType&&8!==b.nodeType?n:a.Td(b)};a.Ec=function(b){return(b=a.Dc(b))?b.$data:n};a.b("bindingHandlers",a.c);a.b("bindingEvent",a.i);a.b("bindingEvent.subscribe",a.i.subscribe);a.b("bindingEvent.startPossiblyAsyncContentBinding",a.i.Cb);a.b("applyBindings",a.vc);a.b("applyBindingsToDescendants",a.Oa);
a.b("applyBindingAccessorsToNode",a.ib);a.b("applyBindingsToNode",a.ld);a.b("contextFor",a.Dc);a.b("dataFor",a.Ec)})();(function(b){function c(c,e){var k=Object.prototype.hasOwnProperty.call(f,c)?f[c]:b,l;k?k.subscribe(e):(k=f[c]=new a.T,k.subscribe(e),d(c,function(b,d){var e=!(!d||!d.synchronous);g[c]={definition:b,Gd:e};delete f[c];l||e?k.notifySubscribers(b):a.na.zb(function(){k.notifySubscribers(b)})}),l=!0)}function d(a,b){e("getConfig",[a],function(c){c?e("loadComponent",[a,c],function(a){b(a,
c)}):b(null,null)})}function e(c,d,f,l){l||(l=a.j.loaders.slice(0));var g=l.shift();if(g){var q=g[c];if(q){var t=!1;if(q.apply(g,d.concat(function(a){t?f(null):null!==a?f(a):e(c,d,f,l)}))!==b&&(t=!0,!g.suppressLoaderExceptions))throw Error("Component loaders must supply values by invoking the callback, not by returning values synchronously.");}else e(c,d,f,l)}else f(null)}var f={},g={};a.j={get:function(d,e){var f=Object.prototype.hasOwnProperty.call(g,d)?g[d]:b;f?f.Gd?a.u.G(function(){e(f.definition)}):
a.na.zb(function(){e(f.definition)}):c(d,e)},Bc:function(a){delete g[a]},oc:e};a.j.loaders=[];a.b("components",a.j);a.b("components.get",a.j.get);a.b("components.clearCachedDefinition",a.j.Bc)})();(function(){function b(b,c,d,e){function g(){0===--B&&e(h)}var h={},B=2,u=d.template;d=d.viewModel;u?f(c,u,function(c){a.j.oc("loadTemplate",[b,c],function(a){h.template=a;g()})}):g();d?f(c,d,function(c){a.j.oc("loadViewModel",[b,c],function(a){h[m]=a;g()})}):g()}function c(a,b,d){if("function"===typeof b)d(function(a){return new b(a)});
else if("function"===typeof b[m])d(b[m]);else if("instance"in b){var e=b.instance;d(function(){return e})}else"viewModel"in b?c(a,b.viewModel,d):a("Unknown viewModel value: "+b)}function d(b){switch(a.a.R(b)){case "script":return a.a.ua(b.text);case "textarea":return a.a.ua(b.value);case "template":if(e(b.content))return a.a.Ca(b.content.childNodes)}return a.a.Ca(b.childNodes)}function e(a){return A.DocumentFragment?a instanceof DocumentFragment:a&&11===a.nodeType}function f(a,b,c){"string"===typeof b.require?
T||A.require?(T||A.require)([b.require],function(a){a&&"object"===typeof a&&a.Xd&&a["default"]&&(a=a["default"]);c(a)}):a("Uses require, but no AMD loader is present"):c(b)}function g(a){return function(b){throw Error("Component '"+a+"': "+b);}}var h={};a.j.register=function(b,c){if(!c)throw Error("Invalid configuration for "+b);if(a.j.tb(b))throw Error("Component "+b+" is already registered");h[b]=c};a.j.tb=function(a){return Object.prototype.hasOwnProperty.call(h,a)};a.j.unregister=function(b){delete h[b];
a.j.Bc(b)};a.j.Fc={getConfig:function(b,c){c(a.j.tb(b)?h[b]:null)},loadComponent:function(a,c,d){var e=g(a);f(e,c,function(c){b(a,e,c,d)})},loadTemplate:function(b,c,f){b=g(b);if("string"===typeof c)f(a.a.ua(c));else if(c instanceof Array)f(c);else if(e(c))f(a.a.la(c.childNodes));else if(c.element)if(c=c.element,A.HTMLElement?c instanceof HTMLElement:c&&c.tagName&&1===c.nodeType)f(d(c));else if("string"===typeof c){var h=w.getElementById(c);h?f(d(h)):b("Cannot find element with ID "+c)}else b("Unknown element type: "+
c);else b("Unknown template value: "+c)},loadViewModel:function(a,b,d){c(g(a),b,d)}};var m="createViewModel";a.b("components.register",a.j.register);a.b("components.isRegistered",a.j.tb);a.b("components.unregister",a.j.unregister);a.b("components.defaultLoader",a.j.Fc);a.j.loaders.push(a.j.Fc);a.j.dd=h})();(function(){function b(b,e){var f=b.getAttribute("params");if(f){var f=c.parseBindingsString(f,e,b,{valueAccessors:!0,bindingParams:!0}),f=a.a.Ga(f,function(c){return a.o(c,null,{l:b})}),g=a.a.Ga(f,
function(c){var e=c.v();return c.ja()?a.o({read:function(){return a.a.f(c())},write:a.Za(e)&&function(a){c()(a)},l:b}):e});Object.prototype.hasOwnProperty.call(g,"$raw")||(g.$raw=f);return g}return{$raw:{}}}a.j.getComponentNameForNode=function(b){var c=a.a.R(b);if(a.j.tb(c)&&(-1!=c.indexOf("-")||"[object HTMLUnknownElement]"==""+b||8>=a.a.W&&b.tagName===c))return c};a.j.tc=function(c,e,f,g){if(1===e.nodeType){var h=a.j.getComponentNameForNode(e);if(h){c=c||{};if(c.component)throw Error('Cannot use the "component" binding on a custom element matching a component');
var m={name:h,params:b(e,f)};c.component=g?function(){return m}:m}}return c};var c=new a.ga;9>a.a.W&&(a.j.register=function(a){return function(b){return a.apply(this,arguments)}}(a.j.register),w.createDocumentFragment=function(b){return function(){var c=b(),f=a.j.dd,g;for(g in f);return c}}(w.createDocumentFragment))})();(function(){function b(b,c,d){c=c.template;if(!c)throw Error("Component '"+b+"' has no template");b=a.a.Ca(c);a.h.va(d,b)}function c(a,b,c){var d=a.createViewModel;return d?d.call(a,
b,c):b}var d=0;a.c.component={init:function(e,f,g,h,m){function k(){var a=l&&l.dispose;"function"===typeof a&&a.call(l);q&&q.s();p=l=q=null}var l,p,q,t=a.a.la(a.h.childNodes(e));a.h.Ea(e);a.a.K.za(e,k);a.o(function(){var g=a.a.f(f()),h,u;"string"===typeof g?h=g:(h=a.a.f(g.name),u=a.a.f(g.params));if(!h)throw Error("No component name specified");var n=a.i.Cb(e,m),z=p=++d;a.j.get(h,function(d){if(p===z){k();if(!d)throw Error("Unknown component '"+h+"'");b(h,d,e);var f=c(d,u,{element:e,templateNodes:t});
d=n.createChildContext(f,{extend:function(a){a.$component=f;a.$componentTemplateNodes=t}});f&&f.koDescendantsComplete&&(q=a.i.subscribe(e,a.i.pa,f.koDescendantsComplete,f));l=f;a.Oa(d,e)}})},null,{l:e});return{controlsDescendantBindings:!0}}};a.h.ea.component=!0})();var V={"class":"className","for":"htmlFor"};a.c.attr={update:function(b,c){var d=a.a.f(c())||{};a.a.P(d,function(c,d){d=a.a.f(d);var g=c.indexOf(":"),g="lookupNamespaceURI"in b&&0<g&&b.lookupNamespaceURI(c.substr(0,g)),h=!1===d||null===
d||d===n;h?g?b.removeAttributeNS(g,c):b.removeAttribute(c):d=d.toString();8>=a.a.W&&c in V?(c=V[c],h?b.removeAttribute(c):b[c]=d):h||(g?b.setAttributeNS(g,c,d):b.setAttribute(c,d));"name"===c&&a.a.Yc(b,h?"":d)})}};(function(){a.c.checked={after:["value","attr"],init:function(b,c,d){function e(){var e=b.checked,f=g();if(!a.S.Ya()&&(e||!m&&!a.S.qa())){var k=a.u.G(c);if(l){var q=p?k.v():k,z=t;t=f;z!==f?e&&(a.a.Na(q,f,!0),a.a.Na(q,z,!1)):a.a.Na(q,f,e);p&&a.Za(k)&&k(q)}else h&&(f===n?f=e:e||(f=n)),a.m.eb(k,
d,"checked",f,!0)}}function f(){var d=a.a.f(c()),e=g();l?(b.checked=0<=a.a.A(d,e),t=e):b.checked=h&&e===n?!!d:g()===d}var g=a.xb(function(){if(d.has("checkedValue"))return a.a.f(d.get("checkedValue"));if(q)return d.has("value")?a.a.f(d.get("value")):b.value}),h="checkbox"==b.type,m="radio"==b.type;if(h||m){var k=c(),l=h&&a.a.f(k)instanceof Array,p=!(l&&k.push&&k.splice),q=m||l,t=l?g():n;m&&!b.name&&a.c.uniqueName.init(b,function(){return!0});a.o(e,null,{l:b});a.a.B(b,"click",e);a.o(f,null,{l:b});
k=n}}};a.m.wa.checked=!0;a.c.checkedValue={update:function(b,c){b.value=a.a.f(c())}}})();a.c["class"]={update:function(b,c){var d=a.a.Db(a.a.f(c()));a.a.Eb(b,b.__ko__cssValue,!1);b.__ko__cssValue=d;a.a.Eb(b,d,!0)}};a.c.css={update:function(b,c){var d=a.a.f(c());null!==d&&"object"==typeof d?a.a.P(d,function(c,d){d=a.a.f(d);a.a.Eb(b,c,d)}):a.c["class"].update(b,c)}};a.c.enable={update:function(b,c){var d=a.a.f(c());d&&b.disabled?b.removeAttribute("disabled"):d||b.disabled||(b.disabled=!0)}};a.c.disable=
{update:function(b,c){a.c.enable.update(b,function(){return!a.a.f(c())})}};a.c.event={init:function(b,c,d,e,f){var g=c()||{};a.a.P(g,function(g){"string"==typeof g&&a.a.B(b,g,function(b){var k,l=c()[g];if(l){try{var p=a.a.la(arguments);e=f.$data;p.unshift(e);k=l.apply(e,p)}finally{!0!==k&&(b.preventDefault?b.preventDefault():b.returnValue=!1)}!1===d.get(g+"Bubble")&&(b.cancelBubble=!0,b.stopPropagation&&b.stopPropagation())}})})}};a.c.foreach={Rc:function(b){return function(){var c=b(),d=a.a.bc(c);
if(!d||"number"==typeof d.length)return{foreach:c,templateEngine:a.ba.Ma};a.a.f(c);return{foreach:d.data,as:d.as,noChildContext:d.noChildContext,includeDestroyed:d.includeDestroyed,afterAdd:d.afterAdd,beforeRemove:d.beforeRemove,afterRender:d.afterRender,beforeMove:d.beforeMove,afterMove:d.afterMove,templateEngine:a.ba.Ma}}},init:function(b,c){return a.c.template.init(b,a.c.foreach.Rc(c))},update:function(b,c,d,e,f){return a.c.template.update(b,a.c.foreach.Rc(c),d,e,f)}};a.m.Ra.foreach=!1;a.h.ea.foreach=
!0;a.c.hasfocus={init:function(b,c,d){function e(e){b.__ko_hasfocusUpdating=!0;var f=b.ownerDocument;if("activeElement"in f){var g;try{g=f.activeElement}catch(l){g=f.body}e=g===b}f=c();a.m.eb(f,d,"hasfocus",e,!0);b.__ko_hasfocusLastValue=e;b.__ko_hasfocusUpdating=!1}var f=e.bind(null,!0),g=e.bind(null,!1);a.a.B(b,"focus",f);a.a.B(b,"focusin",f);a.a.B(b,"blur",g);a.a.B(b,"focusout",g);b.__ko_hasfocusLastValue=!1},update:function(b,c){var d=!!a.a.f(c());b.__ko_hasfocusUpdating||b.__ko_hasfocusLastValue===
d||(d?b.focus():b.blur(),!d&&b.__ko_hasfocusLastValue&&b.ownerDocument.body.focus(),a.u.G(a.a.Fb,null,[b,d?"focusin":"focusout"]))}};a.m.wa.hasfocus=!0;a.c.hasFocus=a.c.hasfocus;a.m.wa.hasFocus="hasfocus";a.c.html={init:function(){return{controlsDescendantBindings:!0}},update:function(b,c){a.a.fc(b,c())}};(function(){function b(b,d,e){a.c[b]={init:function(b,c,h,m,k){var l,p,q={},t,x,n;if(d){m=h.get("as");var u=h.get("noChildContext");n=!(m&&u);q={as:m,noChildContext:u,exportDependencies:n}}x=(t=
"render"==h.get("completeOn"))||h.has(a.i.pa);a.o(function(){var h=a.a.f(c()),m=!e!==!h,u=!p,r;if(n||m!==l){x&&(k=a.i.Cb(b,k));if(m){if(!d||n)q.dataDependency=a.S.o();r=d?k.createChildContext("function"==typeof h?h:c,q):a.S.qa()?k.extend(null,q):k}u&&a.S.qa()&&(p=a.a.Ca(a.h.childNodes(b),!0));m?(u||a.h.va(b,a.a.Ca(p)),a.Oa(r,b)):(a.h.Ea(b),t||a.i.ma(b,a.i.H));l=m}},null,{l:b});return{controlsDescendantBindings:!0}}};a.m.Ra[b]=!1;a.h.ea[b]=!0}b("if");b("ifnot",!1,!0);b("with",!0)})();a.c.let={init:function(b,
c,d,e,f){c=f.extend(c);a.Oa(c,b);return{controlsDescendantBindings:!0}}};a.h.ea.let=!0;var Q={};a.c.options={init:function(b){if("select"!==a.a.R(b))throw Error("options binding applies only to SELECT elements");for(;0<b.length;)b.remove(0);return{controlsDescendantBindings:!0}},update:function(b,c,d){function e(){return a.a.jb(b.options,function(a){return a.selected})}function f(a,b,c){var d=typeof b;return"function"==d?b(a):"string"==d?a[b]:c}function g(c,d){if(x&&l)a.i.ma(b,a.i.H);else if(t.length){var e=
0<=a.a.A(t,a.w.M(d[0]));a.a.Zc(d[0],e);x&&!e&&a.u.G(a.a.Fb,null,[b,"change"])}}var h=b.multiple,m=0!=b.length&&h?b.scrollTop:null,k=a.a.f(c()),l=d.get("valueAllowUnset")&&d.has("value"),p=d.get("optionsIncludeDestroyed");c={};var q,t=[];l||(h?t=a.a.Mb(e(),a.w.M):0<=b.selectedIndex&&t.push(a.w.M(b.options[b.selectedIndex])));k&&("undefined"==typeof k.length&&(k=[k]),q=a.a.jb(k,function(b){return p||b===n||null===b||!a.a.f(b._destroy)}),d.has("optionsCaption")&&(k=a.a.f(d.get("optionsCaption")),null!==
k&&k!==n&&q.unshift(Q)));var x=!1;c.beforeRemove=function(a){b.removeChild(a)};k=g;d.has("optionsAfterRender")&&"function"==typeof d.get("optionsAfterRender")&&(k=function(b,c){g(0,c);a.u.G(d.get("optionsAfterRender"),null,[c[0],b!==Q?b:n])});a.a.ec(b,q,function(c,e,g){g.length&&(t=!l&&g[0].selected?[a.w.M(g[0])]:[],x=!0);e=b.ownerDocument.createElement("option");c===Q?(a.a.Bb(e,d.get("optionsCaption")),a.w.cb(e,n)):(g=f(c,d.get("optionsValue"),c),a.w.cb(e,a.a.f(g)),c=f(c,d.get("optionsText"),g),
a.a.Bb(e,c));return[e]},c,k);if(!l){var B;h?B=t.length&&e().length<t.length:B=t.length&&0<=b.selectedIndex?a.w.M(b.options[b.selectedIndex])!==t[0]:t.length||0<=b.selectedIndex;B&&a.u.G(a.a.Fb,null,[b,"change"])}(l||a.S.Ya())&&a.i.ma(b,a.i.H);a.a.wd(b);m&&20<Math.abs(m-b.scrollTop)&&(b.scrollTop=m)}};a.c.options.$b=a.a.g.Z();a.c.selectedOptions={init:function(b,c,d){function e(){var e=c(),f=[];a.a.D(b.getElementsByTagName("option"),function(b){b.selected&&f.push(a.w.M(b))});a.m.eb(e,d,"selectedOptions",
f)}function f(){var d=a.a.f(c()),e=b.scrollTop;d&&"number"==typeof d.length&&a.a.D(b.getElementsByTagName("option"),function(b){var c=0<=a.a.A(d,a.w.M(b));b.selected!=c&&a.a.Zc(b,c)});b.scrollTop=e}if("select"!=a.a.R(b))throw Error("selectedOptions binding applies only to SELECT elements");var g;a.i.subscribe(b,a.i.H,function(){g?e():(a.a.B(b,"change",e),g=a.o(f,null,{l:b}))},null,{notifyImmediately:!0})},update:function(){}};a.m.wa.selectedOptions=!0;a.c.style={update:function(b,c){var d=a.a.f(c()||
{});a.a.P(d,function(c,d){d=a.a.f(d);if(null===d||d===n||!1===d)d="";if(v)v(b).css(c,d);else if(/^--/.test(c))b.style.setProperty(c,d);else{c=c.replace(/-(\w)/g,function(a,b){return b.toUpperCase()});var g=b.style[c];b.style[c]=d;d===g||b.style[c]!=g||isNaN(d)||(b.style[c]=d+"px")}})}};a.c.submit={init:function(b,c,d,e,f){if("function"!=typeof c())throw Error("The value for a submit binding must be a function");a.a.B(b,"submit",function(a){var d,e=c();try{d=e.call(f.$data,b)}finally{!0!==d&&(a.preventDefault?
a.preventDefault():a.returnValue=!1)}})}};a.c.text={init:function(){return{controlsDescendantBindings:!0}},update:function(b,c){a.a.Bb(b,c())}};a.h.ea.text=!0;(function(){if(A&&A.navigator){var b=function(a){if(a)return parseFloat(a[1])},c=A.navigator.userAgent,d,e,f,g,h;(d=A.opera&&A.opera.version&&parseInt(A.opera.version()))||(h=b(c.match(/Edge\/([^ ]+)$/)))||b(c.match(/Chrome\/([^ ]+)/))||(e=b(c.match(/Version\/([^ ]+) Safari/)))||(f=b(c.match(/Firefox\/([^ ]+)/)))||(g=a.a.W||b(c.match(/MSIE ([^ ]+)/)))||
(g=b(c.match(/rv:([^ )]+)/)))}if(8<=g&&10>g)var m=a.a.g.Z(),k=a.a.g.Z(),l=function(b){var c=this.activeElement;(c=c&&a.a.g.get(c,k))&&c(b)},p=function(b,c){var d=b.ownerDocument;a.a.g.get(d,m)||(a.a.g.set(d,m,!0),a.a.B(d,"selectionchange",l));a.a.g.set(b,k,c)};a.c.textInput={init:function(b,c,k){function l(c,d){a.a.B(b,c,d)}function m(){var d=a.a.f(c());if(null===d||d===n)d="";L!==n&&d===L?a.a.setTimeout(m,4):b.value!==d&&(y=!0,b.value=d,y=!1,v=b.value)}function r(){w||(L=b.value,w=a.a.setTimeout(z,
4))}function z(){clearTimeout(w);L=w=n;var d=b.value;v!==d&&(v=d,a.m.eb(c(),k,"textInput",d))}var v=b.value,w,L,A=9==a.a.W?r:z,y=!1;g&&l("keypress",z);11>g&&l("propertychange",function(a){y||"value"!==a.propertyName||A(a)});8==g&&(l("keyup",z),l("keydown",z));p&&(p(b,A),l("dragend",r));(!g||9<=g)&&l("input",A);5>e&&"textarea"===a.a.R(b)?(l("keydown",r),l("paste",r),l("cut",r)):11>d?l("keydown",r):4>f?(l("DOMAutoComplete",z),l("dragdrop",z),l("drop",z)):h&&"number"===b.type&&l("keydown",r);l("change",
z);l("blur",z);a.o(m,null,{l:b})}};a.m.wa.textInput=!0;a.c.textinput={preprocess:function(a,b,c){c("textInput",a)}}})();a.c.uniqueName={init:function(b,c){if(c()){var d="ko_unique_"+ ++a.c.uniqueName.rd;a.a.Yc(b,d)}}};a.c.uniqueName.rd=0;a.c.using={init:function(b,c,d,e,f){var g;d.has("as")&&(g={as:d.get("as"),noChildContext:d.get("noChildContext")});c=f.createChildContext(c,g);a.Oa(c,b);return{controlsDescendantBindings:!0}}};a.h.ea.using=!0;a.c.value={init:function(b,c,d){var e=a.a.R(b),f="input"==
e;if(!f||"checkbox"!=b.type&&"radio"!=b.type){var g=[],h=d.get("valueUpdate"),m=!1,k=null;h&&("string"==typeof h?g=[h]:g=a.a.wc(h),a.a.Pa(g,"change"));var l=function(){k=null;m=!1;var e=c(),f=a.w.M(b);a.m.eb(e,d,"value",f)};!a.a.W||!f||"text"!=b.type||"off"==b.autocomplete||b.form&&"off"==b.form.autocomplete||-1!=a.a.A(g,"propertychange")||(a.a.B(b,"propertychange",function(){m=!0}),a.a.B(b,"focus",function(){m=!1}),a.a.B(b,"blur",function(){m&&l()}));a.a.D(g,function(c){var d=l;a.a.Ud(c,"after")&&
(d=function(){k=a.w.M(b);a.a.setTimeout(l,0)},c=c.substring(5));a.a.B(b,c,d)});var p;p=f&&"file"==b.type?function(){var d=a.a.f(c());null===d||d===n||""===d?b.value="":a.u.G(l)}:function(){var f=a.a.f(c()),g=a.w.M(b);if(null!==k&&f===k)a.a.setTimeout(p,0);else if(f!==g||g===n)"select"===e?(g=d.get("valueAllowUnset"),a.w.cb(b,f,g),g||f===a.w.M(b)||a.u.G(l)):a.w.cb(b,f)};if("select"===e){var q;a.i.subscribe(b,a.i.H,function(){q?d.get("valueAllowUnset")?p():l():(a.a.B(b,"change",l),q=a.o(p,null,{l:b}))},
null,{notifyImmediately:!0})}else a.a.B(b,"change",l),a.o(p,null,{l:b})}else a.ib(b,{checkedValue:c})},update:function(){}};a.m.wa.value=!0;a.c.visible={update:function(b,c){var d=a.a.f(c()),e="none"!=b.style.display;d&&!e?b.style.display="":!d&&e&&(b.style.display="none")}};a.c.hidden={update:function(b,c){a.c.visible.update(b,function(){return!a.a.f(c())})}};(function(b){a.c[b]={init:function(c,d,e,f,g){return a.c.event.init.call(this,c,function(){var a={};a[b]=d();return a},e,f,g)}}})("click");
a.ca=function(){};a.ca.prototype.renderTemplateSource=function(){throw Error("Override renderTemplateSource");};a.ca.prototype.createJavaScriptEvaluatorBlock=function(){throw Error("Override createJavaScriptEvaluatorBlock");};a.ca.prototype.makeTemplateSource=function(b,c){if("string"==typeof b){c=c||w;var d=c.getElementById(b);if(!d)throw Error("Cannot find template with ID "+b);return new a.C.F(d)}if(1==b.nodeType||8==b.nodeType)return new a.C.ia(b);throw Error("Unknown template type: "+b);};a.ca.prototype.renderTemplate=
function(a,c,d,e){a=this.makeTemplateSource(a,e);return this.renderTemplateSource(a,c,d,e)};a.ca.prototype.isTemplateRewritten=function(a,c){return!1===this.allowTemplateRewriting?!0:this.makeTemplateSource(a,c).data("isRewritten")};a.ca.prototype.rewriteTemplate=function(a,c,d){a=this.makeTemplateSource(a,d);c=c(a.text());a.text(c);a.data("isRewritten",!0)};a.b("templateEngine",a.ca);a.kc=function(){function b(b,c,d,h){b=a.m.ac(b);for(var m=a.m.Ra,k=0;k<b.length;k++){var l=b[k].key;if(Object.prototype.hasOwnProperty.call(m,
l)){var p=m[l];if("function"===typeof p){if(l=p(b[k].value))throw Error(l);}else if(!p)throw Error("This template engine does not support the '"+l+"' binding within its templates");}}d="ko.__tr_ambtns(function($context,$element){return(function(){return{ "+a.m.vb(b,{valueAccessors:!0})+" } })()},'"+d.toLowerCase()+"')";return h.createJavaScriptEvaluatorBlock(d)+c}var c=/(<([a-z]+\d*)(?:\s+(?!data-bind\s*=\s*)[a-z0-9\-]+(?:=(?:\"[^\"]*\"|\'[^\']*\'|[^>]*))?)*\s+)data-bind\s*=\s*(["'])([\s\S]*?)\3/gi,
d=/\x3c!--\s*ko\b\s*([\s\S]*?)\s*--\x3e/g;return{xd:function(b,c,d){c.isTemplateRewritten(b,d)||c.rewriteTemplate(b,function(b){return a.kc.Ld(b,c)},d)},Ld:function(a,f){return a.replace(c,function(a,c,d,e,l){return b(l,c,d,f)}).replace(d,function(a,c){return b(c,"\x3c!-- ko --\x3e","#comment",f)})},md:function(b,c){return a.aa.Xb(function(d,h){var m=d.nextSibling;m&&m.nodeName.toLowerCase()===c&&a.ib(m,b,h)})}}}();a.b("__tr_ambtns",a.kc.md);(function(){a.C={};a.C.F=function(b){if(this.F=b){var c=
a.a.R(b);this.ab="script"===c?1:"textarea"===c?2:"template"==c&&b.content&&11===b.content.nodeType?3:4}};a.C.F.prototype.text=function(){var b=1===this.ab?"text":2===this.ab?"value":"innerHTML";if(0==arguments.length)return this.F[b];var c=arguments[0];"innerHTML"===b?a.a.fc(this.F,c):this.F[b]=c};var b=a.a.g.Z()+"_";a.C.F.prototype.data=function(c){if(1===arguments.length)return a.a.g.get(this.F,b+c);a.a.g.set(this.F,b+c,arguments[1])};var c=a.a.g.Z();a.C.F.prototype.nodes=function(){var b=this.F;
if(0==arguments.length){var e=a.a.g.get(b,c)||{},f=e.lb||(3===this.ab?b.content:4===this.ab?b:n);if(!f||e.jd){var g=this.text();g&&g!==e.bb&&(f=a.a.Md(g,b.ownerDocument),a.a.g.set(b,c,{lb:f,bb:g,jd:!0}))}return f}e=arguments[0];this.ab!==n&&this.text("");a.a.g.set(b,c,{lb:e})};a.C.ia=function(a){this.F=a};a.C.ia.prototype=new a.C.F;a.C.ia.prototype.constructor=a.C.ia;a.C.ia.prototype.text=function(){if(0==arguments.length){var b=a.a.g.get(this.F,c)||{};b.bb===n&&b.lb&&(b.bb=b.lb.innerHTML);return b.bb}a.a.g.set(this.F,
c,{bb:arguments[0]})};a.b("templateSources",a.C);a.b("templateSources.domElement",a.C.F);a.b("templateSources.anonymousTemplate",a.C.ia)})();(function(){function b(b,c,d){var e;for(c=a.h.nextSibling(c);b&&(e=b)!==c;)b=a.h.nextSibling(e),d(e,b)}function c(c,d){if(c.length){var e=c[0],f=c[c.length-1],g=e.parentNode,h=a.ga.instance,m=h.preprocessNode;if(m){b(e,f,function(a,b){var c=a.previousSibling,d=m.call(h,a);d&&(a===e&&(e=d[0]||b),a===f&&(f=d[d.length-1]||c))});c.length=0;if(!e)return;e===f?c.push(e):
(c.push(e,f),a.a.Ua(c,g))}b(e,f,function(b){1!==b.nodeType&&8!==b.nodeType||a.vc(d,b)});b(e,f,function(b){1!==b.nodeType&&8!==b.nodeType||a.aa.cd(b,[d])});a.a.Ua(c,g)}}function d(a){return a.nodeType?a:0<a.length?a[0]:null}function e(b,e,f,h,m){m=m||{};var n=(b&&d(b)||f||{}).ownerDocument,B=m.templateEngine||g;a.kc.xd(f,B,n);f=B.renderTemplate(f,h,m,n);if("number"!=typeof f.length||0<f.length&&"number"!=typeof f[0].nodeType)throw Error("Template engine must return an array of DOM nodes");n=!1;switch(e){case "replaceChildren":a.h.va(b,
f);n=!0;break;case "replaceNode":a.a.Xc(b,f);n=!0;break;case "ignoreTargetNode":break;default:throw Error("Unknown renderMode: "+e);}n&&(c(f,h),m.afterRender&&a.u.G(m.afterRender,null,[f,h[m.as||"$data"]]),"replaceChildren"==e&&a.i.ma(b,a.i.H));return f}function f(b,c,d){return a.O(b)?b():"function"===typeof b?b(c,d):b}var g;a.gc=function(b){if(b!=n&&!(b instanceof a.ca))throw Error("templateEngine must inherit from ko.templateEngine");g=b};a.dc=function(b,c,h,m,t){h=h||{};if((h.templateEngine||g)==
n)throw Error("Set a template engine before calling renderTemplate");t=t||"replaceChildren";if(m){var x=d(m);return a.$(function(){var g=c&&c instanceof a.fa?c:new a.fa(c,null,null,null,{exportDependencies:!0}),n=f(b,g.$data,g),g=e(m,t,n,g,h);"replaceNode"==t&&(m=g,x=d(m))},null,{Sa:function(){return!x||!a.a.Sb(x)},l:x&&"replaceNode"==t?x.parentNode:x})}return a.aa.Xb(function(d){a.dc(b,c,h,d,"replaceNode")})};a.Qd=function(b,d,g,h,m){function x(b,c){a.u.G(a.a.ec,null,[h,b,u,g,r,c]);a.i.ma(h,a.i.H)}
function r(a,b){c(b,v);g.afterRender&&g.afterRender(b,a);v=null}function u(a,c){v=m.createChildContext(a,{as:z,noChildContext:g.noChildContext,extend:function(a){a.$index=c;z&&(a[z+"Index"]=c)}});var d=f(b,a,v);return e(h,"ignoreTargetNode",d,v,g)}var v,z=g.as,w=!1===g.includeDestroyed||a.options.foreachHidesDestroyed&&!g.includeDestroyed;if(w||g.beforeRemove||!a.Pc(d))return a.$(function(){var b=a.a.f(d)||[];"undefined"==typeof b.length&&(b=[b]);w&&(b=a.a.jb(b,function(b){return b===n||null===b||
!a.a.f(b._destroy)}));x(b)},null,{l:h});x(d.v());var A=d.subscribe(function(a){x(d(),a)},null,"arrayChange");A.l(h);return A};var h=a.a.g.Z(),m=a.a.g.Z();a.c.template={init:function(b,c){var d=a.a.f(c());if("string"==typeof d||"name"in d)a.h.Ea(b);else if("nodes"in d){d=d.nodes||[];if(a.O(d))throw Error('The "nodes" option must be a plain, non-observable array.');var e=d[0]&&d[0].parentNode;e&&a.a.g.get(e,m)||(e=a.a.Yb(d),a.a.g.set(e,m,!0));(new a.C.ia(b)).nodes(e)}else if(d=a.h.childNodes(b),0<d.length)e=
a.a.Yb(d),(new a.C.ia(b)).nodes(e);else throw Error("Anonymous template defined, but no template content was provided");return{controlsDescendantBindings:!0}},update:function(b,c,d,e,f){var g=c();c=a.a.f(g);d=!0;e=null;"string"==typeof c?c={}:(g="name"in c?c.name:b,"if"in c&&(d=a.a.f(c["if"])),d&&"ifnot"in c&&(d=!a.a.f(c.ifnot)),d&&!g&&(d=!1));"foreach"in c?e=a.Qd(g,d&&c.foreach||[],c,b,f):d?(d=f,"data"in c&&(d=f.createChildContext(c.data,{as:c.as,noChildContext:c.noChildContext,exportDependencies:!0})),
e=a.dc(g,d,c,b)):a.h.Ea(b);f=e;(c=a.a.g.get(b,h))&&"function"==typeof c.s&&c.s();a.a.g.set(b,h,!f||f.ja&&!f.ja()?n:f)}};a.m.Ra.template=function(b){b=a.m.ac(b);return 1==b.length&&b[0].unknown||a.m.Id(b,"name")?null:"This template engine does not support anonymous templates nested within its templates"};a.h.ea.template=!0})();a.b("setTemplateEngine",a.gc);a.b("renderTemplate",a.dc);a.a.Kc=function(a,c,d){if(a.length&&c.length){var e,f,g,h,m;for(e=f=0;(!d||e<d)&&(h=a[f]);++f){for(g=0;m=c[g];++g)if(h.value===
m.value){h.moved=m.index;m.moved=h.index;c.splice(g,1);e=g=0;break}e+=g}}};a.a.Pb=function(){function b(b,d,e,f,g){var h=Math.min,m=Math.max,k=[],l,p=b.length,q,n=d.length,r=n-p||1,v=p+n+1,u,w,z;for(l=0;l<=p;l++)for(w=u,k.push(u=[]),z=h(n,l+r),q=m(0,l-1);q<=z;q++)u[q]=q?l?b[l-1]===d[q-1]?w[q-1]:h(w[q]||v,u[q-1]||v)+1:q+1:l+1;h=[];m=[];r=[];l=p;for(q=n;l||q;)n=k[l][q]-1,q&&n===k[l][q-1]?m.push(h[h.length]={status:e,value:d[--q],index:q}):l&&n===k[l-1][q]?r.push(h[h.length]={status:f,value:b[--l],index:l}):
(--q,--l,g.sparse||h.push({status:"retained",value:d[q]}));a.a.Kc(r,m,!g.dontLimitMoves&&10*p);return h.reverse()}return function(a,d,e){e="boolean"===typeof e?{dontLimitMoves:e}:e||{};a=a||[];d=d||[];return a.length<d.length?b(a,d,"added","deleted",e):b(d,a,"deleted","added",e)}}();a.b("utils.compareArrays",a.a.Pb);(function(){function b(b,c,d,h,m){var k=[],l=a.$(function(){var l=c(d,m,a.a.Ua(k,b))||[];0<k.length&&(a.a.Xc(k,l),h&&a.u.G(h,null,[d,l,m]));k.length=0;a.a.Nb(k,l)},null,{l:b,Sa:function(){return!a.a.kd(k)}});
return{Y:k,$:l.ja()?l:n}}var c=a.a.g.Z(),d=a.a.g.Z();a.a.ec=function(e,f,g,h,m,k){function l(b){y={Aa:b,pb:a.ta(w++)};v.push(y);r||F.push(y)}function p(b){y=t[b];w!==y.pb.v()&&D.push(y);y.pb(w++);a.a.Ua(y.Y,e);v.push(y)}function q(b,c){if(b)for(var d=0,e=c.length;d<e;d++)a.a.D(c[d].Y,function(a){b(a,d,c[d].Aa)})}f=f||[];"undefined"==typeof f.length&&(f=[f]);h=h||{};var t=a.a.g.get(e,c),r=!t,v=[],u=0,w=0,z=[],A=[],C=[],D=[],F=[],y,I=0;if(r)a.a.D(f,l);else{if(!k||t&&t._countWaitingForRemove){var E=
a.a.Mb(t,function(a){return a.Aa});k=a.a.Pb(E,f,{dontLimitMoves:h.dontLimitMoves,sparse:!0})}for(var E=0,G,H,K;G=k[E];E++)switch(H=G.moved,K=G.index,G.status){case "deleted":for(;u<K;)p(u++);H===n&&(y=t[u],y.$&&(y.$.s(),y.$=n),a.a.Ua(y.Y,e).length&&(h.beforeRemove&&(v.push(y),I++,y.Aa===d?y=null:C.push(y)),y&&z.push.apply(z,y.Y)));u++;break;case "added":for(;w<K;)p(u++);H!==n?(A.push(v.length),p(H)):l(G.value)}for(;w<f.length;)p(u++);v._countWaitingForRemove=I}a.a.g.set(e,c,v);q(h.beforeMove,D);a.a.D(z,
h.beforeRemove?a.oa:a.removeNode);var M,O,P;try{P=e.ownerDocument.activeElement}catch(N){}if(A.length)for(;(E=A.shift())!=n;){y=v[E];for(M=n;E;)if((O=v[--E].Y)&&O.length){M=O[O.length-1];break}for(f=0;u=y.Y[f];M=u,f++)a.h.Wb(e,u,M)}for(E=0;y=v[E];E++){y.Y||a.a.extend(y,b(e,g,y.Aa,m,y.pb));for(f=0;u=y.Y[f];M=u,f++)a.h.Wb(e,u,M);!y.Ed&&m&&(m(y.Aa,y.Y,y.pb),y.Ed=!0,M=y.Y[y.Y.length-1])}P&&e.ownerDocument.activeElement!=P&&P.focus();q(h.beforeRemove,C);for(E=0;E<C.length;++E)C[E].Aa=d;q(h.afterMove,D);
q(h.afterAdd,F)}})();a.b("utils.setDomNodeChildrenFromArrayMapping",a.a.ec);a.ba=function(){this.allowTemplateRewriting=!1};a.ba.prototype=new a.ca;a.ba.prototype.constructor=a.ba;a.ba.prototype.renderTemplateSource=function(b,c,d,e){if(c=(9>a.a.W?0:b.nodes)?b.nodes():null)return a.a.la(c.cloneNode(!0).childNodes);b=b.text();return a.a.ua(b,e)};a.ba.Ma=new a.ba;a.gc(a.ba.Ma);a.b("nativeTemplateEngine",a.ba);(function(){a.$a=function(){var a=this.Hd=function(){if(!v||!v.tmpl)return 0;try{if(0<=v.tmpl.tag.tmpl.open.toString().indexOf("__"))return 2}catch(a){}return 1}();
this.renderTemplateSource=function(b,e,f,g){g=g||w;f=f||{};if(2>a)throw Error("Your version of jQuery.tmpl is too old. Please upgrade to jQuery.tmpl 1.0.0pre or later.");var h=b.data("precompiled");h||(h=b.text()||"",h=v.template(null,"{{ko_with $item.koBindingContext}}"+h+"{{/ko_with}}"),b.data("precompiled",h));b=[e.$data];e=v.extend({koBindingContext:e},f.templateOptions);e=v.tmpl(h,b,e);e.appendTo(g.createElement("div"));v.fragments={};return e};this.createJavaScriptEvaluatorBlock=function(a){return"{{ko_code ((function() { return "+
a+" })()) }}"};this.addTemplate=function(a,b){w.write("<script type='text/html' id='"+a+"'>"+b+"\x3c/script>")};0<a&&(v.tmpl.tag.ko_code={open:"__.push($1 || '');"},v.tmpl.tag.ko_with={open:"with($1) {",close:"} "})};a.$a.prototype=new a.ca;a.$a.prototype.constructor=a.$a;var b=new a.$a;0<b.Hd&&a.gc(b);a.b("jqueryTmplTemplateEngine",a.$a)})()})})();})();

},{}],3:[function(require,module,exports){
module.exports = function createUser(user) {
    return new Promise(resolve => {
      setTimeout(function() {
        resolve({ user, token: "test.token" });
      }, 1000);
    });
  }
},{}],4:[function(require,module,exports){
//var ko = require('knockout');
var ko = require('knockout');
var createUser = require ('../../sdk/index');
var validation = require('knockout.validation');

var viewModel = {

    //track form steps
    activeStep : ko.observable(1),

    // if user do register dont show form and show succeed message
    succeedRegister : ko.observable(false),

    // form fields values
    name: ko.observable().extend({
      minLength: 2,
      required: {
        message: 'Please enter your name.'
      }
    }),
    age: ko.observable().extend({
      min: 1, 
      max: 100,
      required: {
        message: 'Please enter your age.'
      }
      
    }),
    newsletter: ko.observable().extend({required: true}),
    email: ko.observable().extend({
      // custom message
      required: {
          message: 'Please enter your email address.'
      },
      email: true,
     
    }),
    newsletterOptions: ['daily', 'weekly', 'monthly'],

    // form go to next step
    goToNextStep : function(){

      if(this.name.isValid() && this.age.isValid()){
        viewModel.errors.showAllMessages(false)
        var  previousStep  = this.activeStep();
        this.activeStep(previousStep + 1)
      }else{
        viewModel.errors.showAllMessages()
      }
      
    },

    // form go back 1 step
    goToPrevStep : function(){
      var  previousStep  = this.activeStep();
      this.activeStep(previousStep - 1)
    },

    // submit form
    submit: function() {
      // check erros before fire submit
      if (viewModel.errors().length === 0) {
        var userData = {
          name: this.name(),
          age: Number(this.age()),
          email: this.email(),
          newsletter: this.newsletter(),
        }
        createUser(userData).then(function(response){
          viewModel.succeedRegister(true);
          console.log(response)
        })
      }
      else {
          viewModel.errors.showAllMessages();
      }
    },

};

viewModel.errors = ko.validation.group(viewModel);

ko.applyBindings(viewModel);



},{"../../sdk/index":3,"knockout":2,"knockout.validation":1}]},{},[4])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxVc2Vyc1xcTXIuS2lhXFxEZXNrdG9wXFxzaGV5cG9vcl90YXNrXFxmcm9udGVuZC1jaGFsbGVuZ2VcXG5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsIkM6L1VzZXJzL01yLktpYS9EZXNrdG9wL3NoZXlwb29yX3Rhc2svZnJvbnRlbmQtY2hhbGxlbmdlL25vZGVfbW9kdWxlcy9rbm9ja291dC52YWxpZGF0aW9uL2Rpc3Qva25vY2tvdXQudmFsaWRhdGlvbi5qcyIsIkM6L1VzZXJzL01yLktpYS9EZXNrdG9wL3NoZXlwb29yX3Rhc2svZnJvbnRlbmQtY2hhbGxlbmdlL25vZGVfbW9kdWxlcy9rbm9ja291dC9idWlsZC9vdXRwdXQva25vY2tvdXQtbGF0ZXN0LmpzIiwiQzovVXNlcnMvTXIuS2lhL0Rlc2t0b3Avc2hleXBvb3JfdGFzay9mcm9udGVuZC1jaGFsbGVuZ2Uvc2RrL2luZGV4LmpzIiwiQzovVXNlcnMvTXIuS2lhL0Rlc2t0b3Avc2hleXBvb3JfdGFzay9mcm9udGVuZC1jaGFsbGVuZ2Uvc3JjL2pzL2Zha2VfNDRlZWVmNmQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3QrQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0QXV0aG9yOlx0XHRcdEVyaWMgTS4gQmFybmFyZCAtIEBlcmljbWJhcm5hcmRcdFx0XHRcdFx0XHRcdFx0XHJcblx0TGljZW5zZTpcdFx0TUlUIChodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwKVx0XHRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFxyXG5cdERlc2NyaXB0aW9uOlx0VmFsaWRhdGlvbiBMaWJyYXJ5IGZvciBLbm9ja291dEpTXHRcdFx0XHRcdFx0XHRcclxuXHRWZXJzaW9uOlx0XHQyLjAuNFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcclxuPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4qL1xyXG4vKmdsb2JhbHMgcmVxdWlyZTogZmFsc2UsIGV4cG9ydHM6IGZhbHNlLCBkZWZpbmU6IGZhbHNlLCBrbzogZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoZmFjdG9yeSkge1xyXG5cdC8vIE1vZHVsZSBzeXN0ZW1zIG1hZ2ljIGRhbmNlLlxyXG5cclxuXHRpZiAodHlwZW9mIHJlcXVpcmUgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiKSB7XHJcblx0XHQvLyBDb21tb25KUyBvciBOb2RlOiBoYXJkLWNvZGVkIGRlcGVuZGVuY3kgb24gXCJrbm9ja291dFwiXHJcblx0XHRmYWN0b3J5KHJlcXVpcmUoXCJrbm9ja291dFwiKSwgZXhwb3J0cyk7XHJcblx0fSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lW1wiYW1kXCJdKSB7XHJcblx0XHQvLyBBTUQgYW5vbnltb3VzIG1vZHVsZSB3aXRoIGhhcmQtY29kZWQgZGVwZW5kZW5jeSBvbiBcImtub2Nrb3V0XCJcclxuXHRcdGRlZmluZShbXCJrbm9ja291dFwiLCBcImV4cG9ydHNcIl0sIGZhY3RvcnkpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyA8c2NyaXB0PiB0YWc6IHVzZSB0aGUgZ2xvYmFsIGBrb2Agb2JqZWN0LCBhdHRhY2hpbmcgYSBgdmFsaWRhdGlvbmAgcHJvcGVydHlcclxuXHRcdGZhY3Rvcnkoa28sIGtvLnZhbGlkYXRpb24gPSB7fSk7XHJcblx0fVxyXG59KGZ1bmN0aW9uICgga28sIGV4cG9ydHMgKSB7XHJcblxyXG5cdGlmICh0eXBlb2YgKGtvKSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcignS25vY2tvdXQgaXMgcmVxdWlyZWQsIHBsZWFzZSBlbnN1cmUgaXQgaXMgbG9hZGVkIGJlZm9yZSBsb2FkaW5nIHRoaXMgdmFsaWRhdGlvbiBwbHVnLWluJyk7XHJcblx0fVxyXG5cclxuXHQvLyBjcmVhdGUgb3VyIG5hbWVzcGFjZSBvYmplY3RcclxuXHRrby52YWxpZGF0aW9uID0gZXhwb3J0cztcclxuXHJcblx0dmFyIGt2ID0ga28udmFsaWRhdGlvbixcclxuXHRcdGtvVXRpbHMgPSBrby51dGlscyxcclxuXHRcdHVud3JhcCA9IGtvVXRpbHMudW53cmFwT2JzZXJ2YWJsZSxcclxuXHRcdGZvckVhY2ggPSBrb1V0aWxzLmFycmF5Rm9yRWFjaCxcclxuXHRcdGV4dGVuZCA9IGtvVXRpbHMuZXh0ZW5kO1xyXG47LypnbG9iYWwga286IGZhbHNlKi9cclxuXHJcbnZhciBkZWZhdWx0cyA9IHtcclxuXHRyZWdpc3RlckV4dGVuZGVyczogdHJ1ZSxcclxuXHRtZXNzYWdlc09uTW9kaWZpZWQ6IHRydWUsXHJcblx0ZXJyb3JzQXNUaXRsZTogdHJ1ZSwgICAgICAgICAgICAvLyBlbmFibGVzL2Rpc2FibGVzIHNob3dpbmcgb2YgZXJyb3JzIGFzIHRpdGxlIGF0dHJpYnV0ZSBvZiB0aGUgdGFyZ2V0IGVsZW1lbnQuXHJcblx0ZXJyb3JzQXNUaXRsZU9uTW9kaWZpZWQ6IGZhbHNlLCAvLyBzaG93cyB0aGUgZXJyb3Igd2hlbiBob3ZlcmluZyB0aGUgaW5wdXQgZmllbGQgKGRlY29yYXRlRWxlbWVudCBtdXN0IGJlIHRydWUpXHJcblx0bWVzc2FnZVRlbXBsYXRlOiBudWxsLFxyXG5cdGluc2VydE1lc3NhZ2VzOiB0cnVlLCAgICAgICAgICAgLy8gYXV0b21hdGljYWxseSBpbnNlcnRzIHZhbGlkYXRpb24gbWVzc2FnZXMgYXMgPHNwYW4+PC9zcGFuPlxyXG5cdHBhcnNlSW5wdXRBdHRyaWJ1dGVzOiBmYWxzZSwgICAgLy8gcGFyc2VzIHRoZSBIVE1MNSB2YWxpZGF0aW9uIGF0dHJpYnV0ZSBmcm9tIGEgZm9ybSBlbGVtZW50IGFuZCBhZGRzIHRoYXQgdG8gdGhlIG9iamVjdFxyXG5cdHdyaXRlSW5wdXRBdHRyaWJ1dGVzOiBmYWxzZSwgICAgLy8gYWRkcyBIVE1MNSBpbnB1dCB2YWxpZGF0aW9uIGF0dHJpYnV0ZXMgdG8gZm9ybSBlbGVtZW50cyB0aGF0IGtvIG9ic2VydmFibGUncyBhcmUgYm91bmQgdG9cclxuXHRkZWNvcmF0ZUlucHV0RWxlbWVudDogZmFsc2UsICAgICAgICAgLy8gZmFsc2UgdG8ga2VlcCBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XHJcblx0ZGVjb3JhdGVFbGVtZW50T25Nb2RpZmllZDogdHJ1ZSwvLyB0cnVlIHRvIGtlZXAgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxyXG5cdGVycm9yQ2xhc3M6IG51bGwsICAgICAgICAgICAgICAgLy8gc2luZ2xlIGNsYXNzIGZvciBlcnJvciBtZXNzYWdlIGFuZCBlbGVtZW50XHJcblx0ZXJyb3JFbGVtZW50Q2xhc3M6ICd2YWxpZGF0aW9uRWxlbWVudCcsICAvLyBjbGFzcyB0byBkZWNvcmF0ZSBlcnJvciBlbGVtZW50XHJcblx0ZXJyb3JNZXNzYWdlQ2xhc3M6ICd2YWxpZGF0aW9uTWVzc2FnZScsICAvLyBjbGFzcyB0byBkZWNvcmF0ZSBlcnJvciBtZXNzYWdlXHJcblx0YWxsb3dIdG1sTWVzc2FnZXM6IGZhbHNlLFx0XHQvLyBhbGxvd3MgSFRNTCBpbiB2YWxpZGF0aW9uIG1lc3NhZ2VzXHJcblx0Z3JvdXBpbmc6IHtcclxuXHRcdGRlZXA6IGZhbHNlLCAgICAgICAgLy9ieSBkZWZhdWx0IGdyb3VwaW5nIGlzIHNoYWxsb3dcclxuXHRcdG9ic2VydmFibGU6IHRydWUsICAgLy9hbmQgdXNpbmcgb2JzZXJ2YWJsZXNcclxuXHRcdGxpdmU6IGZhbHNlXHRcdCAgICAvL3JlYWN0IHRvIGNoYW5nZXMgdG8gb2JzZXJ2YWJsZUFycmF5cyBpZiBvYnNlcnZhYmxlID09PSB0cnVlXHJcblx0fSxcclxuXHR2YWxpZGF0ZToge1xyXG5cdFx0Ly8gdGhyb3R0bGU6IDEwXHJcblx0fVxyXG59O1xyXG5cclxuLy8gbWFrZSBhIGNvcHkgIHNvIHdlIGNhbiB1c2UgJ3Jlc2V0JyBsYXRlclxyXG52YXIgY29uZmlndXJhdGlvbiA9IGV4dGVuZCh7fSwgZGVmYXVsdHMpO1xyXG5cclxuY29uZmlndXJhdGlvbi5odG1sNUF0dHJpYnV0ZXMgPSBbJ3JlcXVpcmVkJywgJ3BhdHRlcm4nLCAnbWluJywgJ21heCcsICdzdGVwJ107XHJcbmNvbmZpZ3VyYXRpb24uaHRtbDVJbnB1dFR5cGVzID0gWydlbWFpbCcsICdudW1iZXInLCAnZGF0ZSddO1xyXG5cclxuY29uZmlndXJhdGlvbi5yZXNldCA9IGZ1bmN0aW9uICgpIHtcclxuXHRleHRlbmQoY29uZmlndXJhdGlvbiwgZGVmYXVsdHMpO1xyXG59O1xyXG5cclxua3YuY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb247XHJcbjtrdi51dGlscyA9IChmdW5jdGlvbiAoKSB7XHJcblx0dmFyIHNlZWRJZCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cclxuXHR2YXIgZG9tRGF0YSA9IHt9OyAvL2hhc2ggb2YgZGF0YSBvYmplY3RzIHRoYXQgd2UgcmVmZXJlbmNlIGZyb20gZG9tIGVsZW1lbnRzXHJcblx0dmFyIGRvbURhdGFLZXkgPSAnX19rb192YWxpZGF0aW9uX18nO1xyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0aXNBcnJheTogZnVuY3Rpb24gKG8pIHtcclxuXHRcdFx0cmV0dXJuIG8uaXNBcnJheSB8fCBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobykgPT09ICdbb2JqZWN0IEFycmF5XSc7XHJcblx0XHR9LFxyXG5cdFx0aXNPYmplY3Q6IGZ1bmN0aW9uIChvKSB7XHJcblx0XHRcdHJldHVybiBvICE9PSBudWxsICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JztcclxuXHRcdH0sXHJcblx0XHRpc051bWJlcjogZnVuY3Rpb24obykge1xyXG5cdFx0XHRyZXR1cm4gIWlzTmFOKG8pO1xyXG5cdFx0fSxcclxuXHRcdGlzT2JzZXJ2YWJsZUFycmF5OiBmdW5jdGlvbihpbnN0YW5jZSkge1xyXG5cdFx0XHRyZXR1cm4gISFpbnN0YW5jZSAmJlxyXG5cdFx0XHRcdFx0dHlwZW9mIGluc3RhbmNlW1wicmVtb3ZlXCJdID09PSBcImZ1bmN0aW9uXCIgJiZcclxuXHRcdFx0XHRcdHR5cGVvZiBpbnN0YW5jZVtcInJlbW92ZUFsbFwiXSA9PT0gXCJmdW5jdGlvblwiICYmXHJcblx0XHRcdFx0XHR0eXBlb2YgaW5zdGFuY2VbXCJkZXN0cm95XCJdID09PSBcImZ1bmN0aW9uXCIgJiZcclxuXHRcdFx0XHRcdHR5cGVvZiBpbnN0YW5jZVtcImRlc3Ryb3lBbGxcIl0gPT09IFwiZnVuY3Rpb25cIiAmJlxyXG5cdFx0XHRcdFx0dHlwZW9mIGluc3RhbmNlW1wiaW5kZXhPZlwiXSA9PT0gXCJmdW5jdGlvblwiICYmXHJcblx0XHRcdFx0XHR0eXBlb2YgaW5zdGFuY2VbXCJyZXBsYWNlXCJdID09PSBcImZ1bmN0aW9uXCI7XHJcblx0XHR9LFxyXG5cdFx0dmFsdWVzOiBmdW5jdGlvbiAobykge1xyXG5cdFx0XHR2YXIgciA9IFtdO1xyXG5cdFx0XHRmb3IgKHZhciBpIGluIG8pIHtcclxuXHRcdFx0XHRpZiAoby5oYXNPd25Qcm9wZXJ0eShpKSkge1xyXG5cdFx0XHRcdFx0ci5wdXNoKG9baV0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gcjtcclxuXHRcdH0sXHJcblx0XHRnZXRWYWx1ZTogZnVuY3Rpb24gKG8pIHtcclxuXHRcdFx0cmV0dXJuICh0eXBlb2YgbyA9PT0gJ2Z1bmN0aW9uJyA/IG8oKSA6IG8pO1xyXG5cdFx0fSxcclxuXHRcdGhhc0F0dHJpYnV0ZTogZnVuY3Rpb24gKG5vZGUsIGF0dHIpIHtcclxuXHRcdFx0cmV0dXJuIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpICE9PSBudWxsO1xyXG5cdFx0fSxcclxuXHRcdGdldEF0dHJpYnV0ZTogZnVuY3Rpb24gKGVsZW1lbnQsIGF0dHIpIHtcclxuXHRcdFx0cmV0dXJuIGVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHIpO1xyXG5cdFx0fSxcclxuXHRcdHNldEF0dHJpYnV0ZTogZnVuY3Rpb24gKGVsZW1lbnQsIGF0dHIsIHZhbHVlKSB7XHJcblx0XHRcdHJldHVybiBlbGVtZW50LnNldEF0dHJpYnV0ZShhdHRyLCB2YWx1ZSk7XHJcblx0XHR9LFxyXG5cdFx0aXNWYWxpZGF0YWJsZTogZnVuY3Rpb24gKG8pIHtcclxuXHRcdFx0cmV0dXJuICEhKG8gJiYgby5ydWxlcyAmJiBvLmlzVmFsaWQgJiYgby5pc01vZGlmaWVkKTtcclxuXHRcdH0sXHJcblx0XHRpbnNlcnRBZnRlcjogZnVuY3Rpb24gKG5vZGUsIG5ld05vZGUpIHtcclxuXHRcdFx0bm9kZS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdOb2RlLCBub2RlLm5leHRTaWJsaW5nKTtcclxuXHRcdH0sXHJcblx0XHRuZXdJZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRyZXR1cm4gc2VlZElkICs9IDE7XHJcblx0XHR9LFxyXG5cdFx0Z2V0Q29uZmlnT3B0aW9uczogZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuXHRcdFx0dmFyIG9wdGlvbnMgPSBrdi51dGlscy5jb250ZXh0Rm9yKGVsZW1lbnQpO1xyXG5cclxuXHRcdFx0cmV0dXJuIG9wdGlvbnMgfHwga3YuY29uZmlndXJhdGlvbjtcclxuXHRcdH0sXHJcblx0XHRzZXREb21EYXRhOiBmdW5jdGlvbiAobm9kZSwgZGF0YSkge1xyXG5cdFx0XHR2YXIga2V5ID0gbm9kZVtkb21EYXRhS2V5XTtcclxuXHJcblx0XHRcdGlmICgha2V5KSB7XHJcblx0XHRcdFx0bm9kZVtkb21EYXRhS2V5XSA9IGtleSA9IGt2LnV0aWxzLm5ld0lkKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGRvbURhdGFba2V5XSA9IGRhdGE7XHJcblx0XHR9LFxyXG5cdFx0Z2V0RG9tRGF0YTogZnVuY3Rpb24gKG5vZGUpIHtcclxuXHRcdFx0dmFyIGtleSA9IG5vZGVbZG9tRGF0YUtleV07XHJcblxyXG5cdFx0XHRpZiAoIWtleSkge1xyXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBkb21EYXRhW2tleV07XHJcblx0XHR9LFxyXG5cdFx0Y29udGV4dEZvcjogZnVuY3Rpb24gKG5vZGUpIHtcclxuXHRcdFx0c3dpdGNoIChub2RlLm5vZGVUeXBlKSB7XHJcblx0XHRcdFx0Y2FzZSAxOlxyXG5cdFx0XHRcdGNhc2UgODpcclxuXHRcdFx0XHRcdHZhciBjb250ZXh0ID0ga3YudXRpbHMuZ2V0RG9tRGF0YShub2RlKTtcclxuXHRcdFx0XHRcdGlmIChjb250ZXh0KSB7IHJldHVybiBjb250ZXh0OyB9XHJcblx0XHRcdFx0XHRpZiAobm9kZS5wYXJlbnROb2RlKSB7IHJldHVybiBrdi51dGlscy5jb250ZXh0Rm9yKG5vZGUucGFyZW50Tm9kZSk7IH1cclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XHJcblx0XHR9LFxyXG5cdFx0aXNFbXB0eVZhbDogZnVuY3Rpb24gKHZhbCkge1xyXG5cdFx0XHRpZiAodmFsID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAodmFsID09PSBudWxsKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKHZhbCA9PT0gXCJcIikge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH0sXHJcblx0XHRnZXRPcmlnaW5hbEVsZW1lbnRUaXRsZTogZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuXHRcdFx0dmFyIHNhdmVkT3JpZ2luYWxUaXRsZSA9IGt2LnV0aWxzLmdldEF0dHJpYnV0ZShlbGVtZW50LCAnZGF0YS1vcmlnLXRpdGxlJyksXHJcblx0XHRcdFx0Y3VycmVudFRpdGxlID0gZWxlbWVudC50aXRsZSxcclxuXHRcdFx0XHRoYXNTYXZlZE9yaWdpbmFsVGl0bGUgPSBrdi51dGlscy5oYXNBdHRyaWJ1dGUoZWxlbWVudCwgJ2RhdGEtb3JpZy10aXRsZScpO1xyXG5cclxuXHRcdFx0cmV0dXJuIGhhc1NhdmVkT3JpZ2luYWxUaXRsZSA/XHJcblx0XHRcdFx0c2F2ZWRPcmlnaW5hbFRpdGxlIDogY3VycmVudFRpdGxlO1xyXG5cdFx0fSxcclxuXHRcdGFzeW5jOiBmdW5jdGlvbiAoZXhwcikge1xyXG5cdFx0XHRpZiAod2luZG93LnNldEltbWVkaWF0ZSkgeyB3aW5kb3cuc2V0SW1tZWRpYXRlKGV4cHIpOyB9XHJcblx0XHRcdGVsc2UgeyB3aW5kb3cuc2V0VGltZW91dChleHByLCAwKTsgfVxyXG5cdFx0fSxcclxuXHRcdGZvckVhY2g6IGZ1bmN0aW9uIChvYmplY3QsIGNhbGxiYWNrKSB7XHJcblx0XHRcdGlmIChrdi51dGlscy5pc0FycmF5KG9iamVjdCkpIHtcclxuXHRcdFx0XHRyZXR1cm4gZm9yRWFjaChvYmplY3QsIGNhbGxiYWNrKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRmb3IgKHZhciBwcm9wIGluIG9iamVjdCkge1xyXG5cdFx0XHRcdGlmIChvYmplY3QuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcclxuXHRcdFx0XHRcdGNhbGxiYWNrKG9iamVjdFtwcm9wXSwgcHJvcCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxufSgpKTtcclxuO3ZhciBhcGkgPSAoZnVuY3Rpb24gKCkge1xyXG5cclxuXHR2YXIgaXNJbml0aWFsaXplZCA9IDAsXHJcblx0XHRjb25maWd1cmF0aW9uID0ga3YuY29uZmlndXJhdGlvbixcclxuXHRcdHV0aWxzID0ga3YudXRpbHM7XHJcblxyXG5cdGZ1bmN0aW9uIGNsZWFuVXBTdWJzY3JpcHRpb25zKGNvbnRleHQpIHtcclxuXHRcdGZvckVhY2goY29udGV4dC5zdWJzY3JpcHRpb25zLCBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uKSB7XHJcblx0XHRcdHN1YnNjcmlwdGlvbi5kaXNwb3NlKCk7XHJcblx0XHR9KTtcclxuXHRcdGNvbnRleHQuc3Vic2NyaXB0aW9ucyA9IFtdO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGlzcG9zZShjb250ZXh0KSB7XHJcblx0XHRpZiAoY29udGV4dC5vcHRpb25zLmRlZXApIHtcclxuXHRcdFx0Zm9yRWFjaChjb250ZXh0LmZsYWdnZWQsIGZ1bmN0aW9uIChvYmopIHtcclxuXHRcdFx0XHRkZWxldGUgb2JqLl9fa3ZfdHJhdmVyc2VkO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0Y29udGV4dC5mbGFnZ2VkLmxlbmd0aCA9IDA7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCFjb250ZXh0Lm9wdGlvbnMubGl2ZSkge1xyXG5cdFx0XHRjbGVhblVwU3Vic2NyaXB0aW9ucyhjb250ZXh0KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHRyYXZlcnNlR3JhcGgob2JqLCBjb250ZXh0LCBsZXZlbCkge1xyXG5cdFx0dmFyIG9ialZhbHVlcyA9IFtdLFxyXG5cdFx0XHR2YWwgPSBvYmoucGVlayA/IG9iai5wZWVrKCkgOiBvYmo7XHJcblxyXG5cdFx0aWYgKG9iai5fX2t2X3RyYXZlcnNlZCA9PT0gdHJ1ZSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGNvbnRleHQub3B0aW9ucy5kZWVwKSB7XHJcblx0XHRcdG9iai5fX2t2X3RyYXZlcnNlZCA9IHRydWU7XHJcblx0XHRcdGNvbnRleHQuZmxhZ2dlZC5wdXNoKG9iaik7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly9kZWZhdWx0IGxldmVsIHZhbHVlIGRlcGVuZHMgb24gZGVlcCBvcHRpb24uXHJcblx0XHRsZXZlbCA9IChsZXZlbCAhPT0gdW5kZWZpbmVkID8gbGV2ZWwgOiBjb250ZXh0Lm9wdGlvbnMuZGVlcCA/IDEgOiAtMSk7XHJcblxyXG5cdFx0Ly8gaWYgb2JqZWN0IGlzIG9ic2VydmFibGUgdGhlbiBhZGQgaXQgdG8gdGhlIGxpc3RcclxuXHRcdGlmIChrby5pc09ic2VydmFibGUob2JqKSkge1xyXG5cdFx0XHQvLyBlbnN1cmUgaXQncyB2YWxpZGF0YWJsZSBidXQgZG9uJ3QgZXh0ZW5kIHZhbGlkYXRlZE9ic2VydmFibGUgYmVjYXVzZSBpdFxyXG5cdFx0XHQvLyB3b3VsZCBvdmVyd3JpdGUgaXNWYWxpZCBwcm9wZXJ0eS5cclxuXHRcdFx0aWYgKCFvYmouZXJyb3JzICYmICF1dGlscy5pc1ZhbGlkYXRhYmxlKG9iaikpIHtcclxuXHRcdFx0XHRvYmouZXh0ZW5kKHsgdmFsaWRhdGFibGU6IHRydWUgfSk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29udGV4dC52YWxpZGF0YWJsZXMucHVzaChvYmopO1xyXG5cclxuXHRcdFx0aWYgKGNvbnRleHQub3B0aW9ucy5saXZlICYmIHV0aWxzLmlzT2JzZXJ2YWJsZUFycmF5KG9iaikpIHtcclxuXHRcdFx0XHRjb250ZXh0LnN1YnNjcmlwdGlvbnMucHVzaChvYmouc3Vic2NyaWJlKGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGNvbnRleHQuZ3JhcGhNb25pdG9yLnZhbHVlSGFzTXV0YXRlZCgpO1xyXG5cdFx0XHRcdH0pKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vZ2V0IGxpc3Qgb2YgdmFsdWVzIGVpdGhlciBmcm9tIGFycmF5IG9yIG9iamVjdCBidXQgaWdub3JlIG5vbi1vYmplY3RzXHJcblx0XHQvLyBhbmQgZGVzdHJveWVkIG9iamVjdHNcclxuXHRcdGlmICh2YWwgJiYgIXZhbC5fZGVzdHJveSkge1xyXG5cdFx0XHRpZiAodXRpbHMuaXNBcnJheSh2YWwpKSB7XHJcblx0XHRcdFx0b2JqVmFsdWVzID0gdmFsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKHV0aWxzLmlzT2JqZWN0KHZhbCkpIHtcclxuXHRcdFx0XHRvYmpWYWx1ZXMgPSB1dGlscy52YWx1ZXModmFsKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vcHJvY2VzcyByZWN1cnNpdmVseSBpZiBpdCBpcyBkZWVwIGdyb3VwaW5nXHJcblx0XHRpZiAobGV2ZWwgIT09IDApIHtcclxuXHRcdFx0dXRpbHMuZm9yRWFjaChvYmpWYWx1ZXMsIGZ1bmN0aW9uIChvYnNlcnZhYmxlKSB7XHJcblx0XHRcdFx0Ly9idXQgbm90IGZhbHN5IHRoaW5ncyBhbmQgbm90IEhUTUwgRWxlbWVudHNcclxuXHRcdFx0XHRpZiAob2JzZXJ2YWJsZSAmJiAhb2JzZXJ2YWJsZS5ub2RlVHlwZSAmJiAoIWtvLmlzQ29tcHV0ZWQob2JzZXJ2YWJsZSkgfHwgb2JzZXJ2YWJsZS5ydWxlcykpIHtcclxuXHRcdFx0XHRcdHRyYXZlcnNlR3JhcGgob2JzZXJ2YWJsZSwgY29udGV4dCwgbGV2ZWwgKyAxKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcnVuVHJhdmVyc2FsKG9iaiwgY29udGV4dCkge1xyXG5cdFx0Y29udGV4dC52YWxpZGF0YWJsZXMgPSBbXTtcclxuXHRcdGNsZWFuVXBTdWJzY3JpcHRpb25zKGNvbnRleHQpO1xyXG5cdFx0dHJhdmVyc2VHcmFwaChvYmosIGNvbnRleHQpO1xyXG5cdFx0ZGlzcG9zZShjb250ZXh0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNvbGxlY3RFcnJvcnMoYXJyYXkpIHtcclxuXHRcdHZhciBlcnJvcnMgPSBbXTtcclxuXHRcdGZvckVhY2goYXJyYXksIGZ1bmN0aW9uIChvYnNlcnZhYmxlKSB7XHJcblx0XHRcdC8vIERvIG5vdCBjb2xsZWN0IHZhbGlkYXRlZE9ic2VydmFibGUgZXJyb3JzXHJcblx0XHRcdGlmICh1dGlscy5pc1ZhbGlkYXRhYmxlKG9ic2VydmFibGUpICYmICFvYnNlcnZhYmxlLmlzVmFsaWQoKSkge1xyXG5cdFx0XHRcdC8vIFVzZSBwZWVrIGJlY2F1c2Ugd2UgZG9uJ3Qgd2FudCBhIGRlcGVuZGVuY3kgZm9yICdlcnJvcicgcHJvcGVydHkgYmVjYXVzZSBpdFxyXG5cdFx0XHRcdC8vIGNoYW5nZXMgYmVmb3JlICdpc1ZhbGlkJyBkb2VzLiAoSXNzdWUgIzk5KVxyXG5cdFx0XHRcdGVycm9ycy5wdXNoKG9ic2VydmFibGUuZXJyb3IucGVlaygpKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0XHRyZXR1cm4gZXJyb3JzO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdC8vQ2FsbCB0aGlzIG9uIHN0YXJ0dXBcclxuXHRcdC8vYW55IGNvbmZpZyBjYW4gYmUgb3ZlcnJpZGRlbiB3aXRoIHRoZSBwYXNzZWQgaW4gb3B0aW9uc1xyXG5cdFx0aW5pdDogZnVuY3Rpb24gKG9wdGlvbnMsIGZvcmNlKSB7XHJcblx0XHRcdC8vZG9uZSBydW4gdGhpcyBtdWx0aXBsZSB0aW1lcyBpZiB3ZSBkb24ndCByZWFsbHkgd2FudCB0b1xyXG5cdFx0XHRpZiAoaXNJbml0aWFsaXplZCA+IDAgJiYgIWZvcmNlKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvL2JlY2F1c2Ugd2Ugd2lsbCBiZSBhY2Nlc3Npbmcgb3B0aW9ucyBwcm9wZXJ0aWVzIGl0IGhhcyB0byBiZSBhbiBvYmplY3QgYXQgbGVhc3RcclxuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcblx0XHRcdC8vaWYgc3BlY2lmaWMgZXJyb3IgY2xhc3NlcyBhcmUgbm90IHByb3ZpZGVkIHRoZW4gYXBwbHkgZ2VuZXJpYyBlcnJvckNsYXNzXHJcblx0XHRcdC8vaXQgaGFzIHRvIGJlIGRvbmUgb24gb3B0aW9uIHNvIHRoYXQgb3B0aW9ucy5lcnJvckNsYXNzIGNhbiBvdmVycmlkZSBkZWZhdWx0XHJcblx0XHRcdC8vZXJyb3JFbGVtZW50Q2xhc3MgYW5kIGVycm9yTWVzc2FnZSBjbGFzcyBidXQgbm90IHRob3NlIHByb3ZpZGVkIGluIG9wdGlvbnNcclxuXHRcdFx0b3B0aW9ucy5lcnJvckVsZW1lbnRDbGFzcyA9IG9wdGlvbnMuZXJyb3JFbGVtZW50Q2xhc3MgfHwgb3B0aW9ucy5lcnJvckNsYXNzIHx8IGNvbmZpZ3VyYXRpb24uZXJyb3JFbGVtZW50Q2xhc3M7XHJcblx0XHRcdG9wdGlvbnMuZXJyb3JNZXNzYWdlQ2xhc3MgPSBvcHRpb25zLmVycm9yTWVzc2FnZUNsYXNzIHx8IG9wdGlvbnMuZXJyb3JDbGFzcyB8fCBjb25maWd1cmF0aW9uLmVycm9yTWVzc2FnZUNsYXNzO1xyXG5cclxuXHRcdFx0ZXh0ZW5kKGNvbmZpZ3VyYXRpb24sIG9wdGlvbnMpO1xyXG5cclxuXHRcdFx0aWYgKGNvbmZpZ3VyYXRpb24ucmVnaXN0ZXJFeHRlbmRlcnMpIHtcclxuXHRcdFx0XHRrdi5yZWdpc3RlckV4dGVuZGVycygpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpc0luaXRpYWxpemVkID0gMTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Ly8gcmVzZXRzIHRoZSBjb25maWcgYmFjayB0byBpdHMgb3JpZ2luYWwgc3RhdGVcclxuXHRcdHJlc2V0OiBrdi5jb25maWd1cmF0aW9uLnJlc2V0LFxyXG5cclxuXHRcdC8vIHJlY3Vyc2l2ZWx5IHdhbGtzIGEgdmlld01vZGVsIGFuZCBjcmVhdGVzIGFuIG9iamVjdCB0aGF0XHJcblx0XHQvLyBwcm92aWRlcyB2YWxpZGF0aW9uIGluZm9ybWF0aW9uIGZvciB0aGUgZW50aXJlIHZpZXdNb2RlbFxyXG5cdFx0Ly8gb2JqIC0+IHRoZSB2aWV3TW9kZWwgdG8gd2Fsa1xyXG5cdFx0Ly8gb3B0aW9ucyAtPiB7XHJcblx0XHQvL1x0ICBkZWVwOiBmYWxzZSwgLy8gaWYgdHJ1ZSwgd2lsbCB3YWxrIHBhc3QgdGhlIGZpcnN0IGxldmVsIG9mIHZpZXdNb2RlbCBwcm9wZXJ0aWVzXHJcblx0XHQvL1x0ICBvYnNlcnZhYmxlOiBmYWxzZSAvLyBpZiB0cnVlLCByZXR1cm5zIGEgY29tcHV0ZWQgb2JzZXJ2YWJsZSBpbmRpY2F0aW5nIGlmIHRoZSB2aWV3TW9kZWwgaXMgdmFsaWRcclxuXHRcdC8vIH1cclxuXHRcdGdyb3VwOiBmdW5jdGlvbiBncm91cChvYmosIG9wdGlvbnMpIHsgLy8gYXJyYXkgb2Ygb2JzZXJ2YWJsZXMgb3Igdmlld01vZGVsXHJcblx0XHRcdG9wdGlvbnMgPSBleHRlbmQoZXh0ZW5kKHt9LCBjb25maWd1cmF0aW9uLmdyb3VwaW5nKSwgb3B0aW9ucyk7XHJcblxyXG5cdFx0XHR2YXIgY29udGV4dCA9IHtcclxuXHRcdFx0XHRvcHRpb25zOiBvcHRpb25zLFxyXG5cdFx0XHRcdGdyYXBoTW9uaXRvcjoga28ub2JzZXJ2YWJsZSgpLFxyXG5cdFx0XHRcdGZsYWdnZWQ6IFtdLFxyXG5cdFx0XHRcdHN1YnNjcmlwdGlvbnM6IFtdLFxyXG5cdFx0XHRcdHZhbGlkYXRhYmxlczogW11cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHZhciByZXN1bHQgPSBudWxsO1xyXG5cclxuXHRcdFx0Ly9pZiB1c2luZyBvYnNlcnZhYmxlcyB0aGVuIHRyYXZlcnNlIHN0cnVjdHVyZSBvbmNlIGFuZCBhZGQgb2JzZXJ2YWJsZXNcclxuXHRcdFx0aWYgKG9wdGlvbnMub2JzZXJ2YWJsZSkge1xyXG5cdFx0XHRcdHJlc3VsdCA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGNvbnRleHQuZ3JhcGhNb25pdG9yKCk7IC8vcmVnaXN0ZXIgZGVwZW5kZW5jeVxyXG5cdFx0XHRcdFx0cnVuVHJhdmVyc2FsKG9iaiwgY29udGV4dCk7XHJcblx0XHRcdFx0XHRyZXR1cm4gY29sbGVjdEVycm9ycyhjb250ZXh0LnZhbGlkYXRhYmxlcyk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7IC8vaWYgbm90IHVzaW5nIG9ic2VydmFibGVzIHRoZW4gZXZlcnkgY2FsbCB0byBlcnJvcigpIHNob3VsZCB0cmF2ZXJzZSB0aGUgc3RydWN0dXJlXHJcblx0XHRcdFx0cmVzdWx0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0cnVuVHJhdmVyc2FsKG9iaiwgY29udGV4dCk7XHJcblx0XHRcdFx0XHRyZXR1cm4gY29sbGVjdEVycm9ycyhjb250ZXh0LnZhbGlkYXRhYmxlcyk7XHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmVzdWx0LnNob3dBbGxNZXNzYWdlcyA9IGZ1bmN0aW9uIChzaG93KSB7IC8vIHRoYW5rcyBAaGVsaW9zUG9ydGFsXHJcblx0XHRcdFx0aWYgKHNob3cgPT09IHVuZGVmaW5lZCkgey8vZGVmYXVsdCB0byB0cnVlXHJcblx0XHRcdFx0XHRzaG93ID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJlc3VsdC5mb3JFYWNoKGZ1bmN0aW9uIChvYnNlcnZhYmxlKSB7XHJcblx0XHRcdFx0XHRpZiAodXRpbHMuaXNWYWxpZGF0YWJsZShvYnNlcnZhYmxlKSkge1xyXG5cdFx0XHRcdFx0XHRvYnNlcnZhYmxlLmlzTW9kaWZpZWQoc2hvdyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRyZXN1bHQuaXNBbnlNZXNzYWdlU2hvd24gPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0dmFyIGludmFsaWRBbmRNb2RpZmllZFByZXNlbnQ7XHJcblxyXG5cdFx0XHRcdGludmFsaWRBbmRNb2RpZmllZFByZXNlbnQgPSAhIXJlc3VsdC5maW5kKGZ1bmN0aW9uIChvYnNlcnZhYmxlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdXRpbHMuaXNWYWxpZGF0YWJsZShvYnNlcnZhYmxlKSAmJiAhb2JzZXJ2YWJsZS5pc1ZhbGlkKCkgJiYgb2JzZXJ2YWJsZS5pc01vZGlmaWVkKCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0cmV0dXJuIGludmFsaWRBbmRNb2RpZmllZFByZXNlbnQ7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRyZXN1bHQuZmlsdGVyID0gZnVuY3Rpb24ocHJlZGljYXRlKSB7XHJcblx0XHRcdFx0cHJlZGljYXRlID0gcHJlZGljYXRlIHx8IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRydWU7IH07XHJcblx0XHRcdFx0Ly8gZW5zdXJlIHdlIGhhdmUgbGF0ZXN0IGNoYW5nZXNcclxuXHRcdFx0XHRyZXN1bHQoKTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIGtvVXRpbHMuYXJyYXlGaWx0ZXIoY29udGV4dC52YWxpZGF0YWJsZXMsIHByZWRpY2F0ZSk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRyZXN1bHQuZmluZCA9IGZ1bmN0aW9uKHByZWRpY2F0ZSkge1xyXG5cdFx0XHRcdHByZWRpY2F0ZSA9IHByZWRpY2F0ZSB8fCBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9O1xyXG5cdFx0XHRcdC8vIGVuc3VyZSB3ZSBoYXZlIGxhdGVzdCBjaGFuZ2VzXHJcblx0XHRcdFx0cmVzdWx0KCk7XHJcblxyXG5cdFx0XHRcdHJldHVybiBrb1V0aWxzLmFycmF5Rmlyc3QoY29udGV4dC52YWxpZGF0YWJsZXMsIHByZWRpY2F0ZSk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRyZXN1bHQuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcblx0XHRcdFx0Y2FsbGJhY2sgPSBjYWxsYmFjayB8fCBmdW5jdGlvbiAoKSB7IH07XHJcblx0XHRcdFx0Ly8gZW5zdXJlIHdlIGhhdmUgbGF0ZXN0IGNoYW5nZXNcclxuXHRcdFx0XHRyZXN1bHQoKTtcclxuXHJcblx0XHRcdFx0Zm9yRWFjaChjb250ZXh0LnZhbGlkYXRhYmxlcywgY2FsbGJhY2spO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0cmVzdWx0Lm1hcCA9IGZ1bmN0aW9uKG1hcHBpbmcpIHtcclxuXHRcdFx0XHRtYXBwaW5nID0gbWFwcGluZyB8fCBmdW5jdGlvbiAoaXRlbSkgeyByZXR1cm4gaXRlbTsgfTtcclxuXHRcdFx0XHQvLyBlbnN1cmUgd2UgaGF2ZSBsYXRlc3QgY2hhbmdlc1xyXG5cdFx0XHRcdHJlc3VsdCgpO1xyXG5cclxuXHRcdFx0XHRyZXR1cm4ga29VdGlscy5hcnJheU1hcChjb250ZXh0LnZhbGlkYXRhYmxlcywgbWFwcGluZyk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQHByaXZhdGUgWW91IHNob3VsZCBub3QgcmVseSBvbiB0aGlzIG1ldGhvZCBiZWluZyBoZXJlLlxyXG5cdFx0XHQgKiBJdCdzIGEgcHJpdmF0ZSBtZXRob2QgYW5kIGl0IG1heSBjaGFuZ2UgaW4gdGhlIGZ1dHVyZS5cclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQGRlc2NyaXB0aW9uIFVwZGF0ZXMgdGhlIHZhbGlkYXRlZCBvYmplY3QgYW5kIGNvbGxlY3RzIGVycm9ycyBmcm9tIGl0LlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0cmVzdWx0Ll91cGRhdGVTdGF0ZSA9IGZ1bmN0aW9uKG5ld1ZhbHVlKSB7XHJcblx0XHRcdFx0aWYgKCF1dGlscy5pc09iamVjdChuZXdWYWx1ZSkpIHtcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignQW4gb2JqZWN0IGlzIHJlcXVpcmVkLicpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRvYmogPSBuZXdWYWx1ZTtcclxuXHRcdFx0XHRpZiAob3B0aW9ucy5vYnNlcnZhYmxlKSB7XHJcblx0XHRcdFx0XHRjb250ZXh0LmdyYXBoTW9uaXRvci52YWx1ZUhhc011dGF0ZWQoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHRydW5UcmF2ZXJzYWwobmV3VmFsdWUsIGNvbnRleHQpO1xyXG5cdFx0XHRcdFx0cmV0dXJuIGNvbGxlY3RFcnJvcnMoY29udGV4dC52YWxpZGF0YWJsZXMpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcclxuXHRcdH0sXHJcblxyXG5cdFx0Zm9ybWF0TWVzc2FnZTogZnVuY3Rpb24gKG1lc3NhZ2UsIHBhcmFtcywgb2JzZXJ2YWJsZSkge1xyXG5cdFx0XHRpZiAodXRpbHMuaXNPYmplY3QocGFyYW1zKSAmJiBwYXJhbXMudHlwZUF0dHIpIHtcclxuXHRcdFx0XHRwYXJhbXMgPSBwYXJhbXMudmFsdWU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKHR5cGVvZiBtZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0cmV0dXJuIG1lc3NhZ2UocGFyYW1zLCBvYnNlcnZhYmxlKTtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIgcmVwbGFjZW1lbnRzID0gdW53cmFwKHBhcmFtcyk7XHJcblx0XHRcdGlmIChyZXBsYWNlbWVudHMgPT0gbnVsbCkge1xyXG5cdFx0XHRcdHJlcGxhY2VtZW50cyA9IFtdO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICghdXRpbHMuaXNBcnJheShyZXBsYWNlbWVudHMpKSB7XHJcblx0XHRcdFx0cmVwbGFjZW1lbnRzID0gW3JlcGxhY2VtZW50c107XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG1lc3NhZ2UucmVwbGFjZSgveyhcXGQrKX0vZ2ksIGZ1bmN0aW9uKG1hdGNoLCBpbmRleCkge1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgcmVwbGFjZW1lbnRzW2luZGV4XSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0XHRcdHJldHVybiByZXBsYWNlbWVudHNbaW5kZXhdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gbWF0Y2g7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBhZGRSdWxlOlxyXG5cdFx0Ly8gVGhpcyB0YWtlcyBpbiBhIGtvLm9ic2VydmFibGUgYW5kIGEgUnVsZSBDb250ZXh0IC0gd2hpY2ggaXMganVzdCBhIHJ1bGUgbmFtZSBhbmQgcGFyYW1zIHRvIHN1cHBseSB0byB0aGUgdmFsaWRhdG9yXHJcblx0XHQvLyBpZToga3YuYWRkUnVsZShteU9ic2VydmFibGUsIHtcclxuXHRcdC8vXHRcdCAgcnVsZTogJ3JlcXVpcmVkJyxcclxuXHRcdC8vXHRcdCAgcGFyYW1zOiB0cnVlXHJcblx0XHQvL1x0ICB9KTtcclxuXHRcdC8vXHJcblx0XHRhZGRSdWxlOiBmdW5jdGlvbiAob2JzZXJ2YWJsZSwgcnVsZSkge1xyXG5cdFx0XHRvYnNlcnZhYmxlLmV4dGVuZCh7IHZhbGlkYXRhYmxlOiB0cnVlIH0pO1xyXG5cclxuXHRcdFx0dmFyIGhhc1J1bGUgPSAhIWtvVXRpbHMuYXJyYXlGaXJzdChvYnNlcnZhYmxlLnJ1bGVzKCksIGZ1bmN0aW9uKGl0ZW0pIHtcclxuXHRcdFx0XHRyZXR1cm4gaXRlbS5ydWxlICYmIGl0ZW0ucnVsZSA9PT0gcnVsZS5ydWxlO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGlmICghaGFzUnVsZSkge1xyXG5cdFx0XHRcdC8vcHVzaCBhIFJ1bGUgQ29udGV4dCB0byB0aGUgb2JzZXJ2YWJsZXMgbG9jYWwgYXJyYXkgb2YgUnVsZSBDb250ZXh0c1xyXG5cdFx0XHRcdG9ic2VydmFibGUucnVsZXMucHVzaChydWxlKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gb2JzZXJ2YWJsZTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Ly8gYWRkQW5vbnltb3VzUnVsZTpcclxuXHRcdC8vIEFub255bW91cyBSdWxlcyBlc3NlbnRpYWxseSBoYXZlIGFsbCB0aGUgcHJvcGVydGllcyBvZiBhIFJ1bGUsIGJ1dCBhcmUgb25seSBzcGVjaWZpYyBmb3IgYSBjZXJ0YWluIHByb3BlcnR5XHJcblx0XHQvLyBhbmQgZGV2ZWxvcGVycyB0eXBpY2FsbHkgYXJlIHdhbnRpbmcgdG8gYWRkIHRoZW0gb24gdGhlIGZseSBvciBub3QgcmVnaXN0ZXIgYSBydWxlIHdpdGggdGhlICdrdi5ydWxlcycgb2JqZWN0XHJcblx0XHQvL1xyXG5cdFx0Ly8gRXhhbXBsZTpcclxuXHRcdC8vIHZhciB0ZXN0ID0ga28ub2JzZXJ2YWJsZSgnc29tZXRoaW5nJykuZXh0ZW5keyhcclxuXHRcdC8vXHQgIHZhbGlkYXRpb246IHtcclxuXHRcdC8vXHRcdCAgdmFsaWRhdG9yOiBmdW5jdGlvbih2YWwsIHNvbWVPdGhlclZhbCl7XHJcblx0XHQvL1x0XHRcdCAgcmV0dXJuIHRydWU7XHJcblx0XHQvL1x0XHQgIH0sXHJcblx0XHQvL1x0XHQgIG1lc3NhZ2U6IFwiU29tZXRoaW5nIG11c3QgYmUgcmVhbGx5IHdyb25nIScsXHJcblx0XHQvL1x0XHQgIHBhcmFtczogdHJ1ZVxyXG5cdFx0Ly9cdCAgfVxyXG5cdFx0Ly8gICl9O1xyXG5cdFx0YWRkQW5vbnltb3VzUnVsZTogZnVuY3Rpb24gKG9ic2VydmFibGUsIHJ1bGVPYmopIHtcclxuXHRcdFx0aWYgKHJ1bGVPYmpbJ21lc3NhZ2UnXSA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0cnVsZU9ialsnbWVzc2FnZSddID0gJ0Vycm9yJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly9tYWtlIHN1cmUgb25seUlmIGlzIGhvbm91cmVkXHJcblx0XHRcdGlmIChydWxlT2JqLm9ubHlJZikge1xyXG5cdFx0XHRcdHJ1bGVPYmouY29uZGl0aW9uID0gcnVsZU9iai5vbmx5SWY7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vYWRkIHRoZSBhbm9ueW1vdXMgcnVsZSB0byB0aGUgb2JzZXJ2YWJsZVxyXG5cdFx0XHRrdi5hZGRSdWxlKG9ic2VydmFibGUsIHJ1bGVPYmopO1xyXG5cdFx0fSxcclxuXHJcblx0XHRhZGRFeHRlbmRlcjogZnVuY3Rpb24gKHJ1bGVOYW1lKSB7XHJcblx0XHRcdGtvLmV4dGVuZGVyc1tydWxlTmFtZV0gPSBmdW5jdGlvbiAob2JzZXJ2YWJsZSwgcGFyYW1zKSB7XHJcblx0XHRcdFx0Ly9wYXJhbXMgY2FuIGNvbWUgaW4gYSBmZXcgZmxhdm9yc1xyXG5cdFx0XHRcdC8vIDEuIEp1c3QgdGhlIHBhcmFtcyB0byBiZSBwYXNzZWQgdG8gdGhlIHZhbGlkYXRvclxyXG5cdFx0XHRcdC8vIDIuIEFuIG9iamVjdCBjb250YWluaW5nIHRoZSBNZXNzYWdlIHRvIGJlIHVzZWQgYW5kIHRoZSBQYXJhbXMgdG8gcGFzcyB0byB0aGUgdmFsaWRhdG9yXHJcblx0XHRcdFx0Ly8gMy4gQSBjb25kaXRpb24gd2hlbiB0aGUgdmFsaWRhdGlvbiBydWxlIHRvIGJlIGFwcGxpZWRcclxuXHRcdFx0XHQvL1xyXG5cdFx0XHRcdC8vIEV4YW1wbGU6XHJcblx0XHRcdFx0Ly8gdmFyIHRlc3QgPSBrby5vYnNlcnZhYmxlKDMpLmV4dGVuZCh7XHJcblx0XHRcdFx0Ly9cdCAgbWF4OiB7XHJcblx0XHRcdFx0Ly9cdFx0ICBtZXNzYWdlOiAnVGhpcyBzcGVjaWFsIGZpZWxkIGhhcyBhIE1heCBvZiB7MH0nLFxyXG5cdFx0XHRcdC8vXHRcdCAgcGFyYW1zOiAyLFxyXG5cdFx0XHRcdC8vXHRcdCAgb25seUlmOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHQvL1x0XHRcdHJldHVybiBzcGVjaWFsRmllbGQuSXNWaXNpYmxlKCk7XHJcblx0XHRcdFx0Ly9cdFx0ICB9XHJcblx0XHRcdFx0Ly9cdCAgfVxyXG5cdFx0XHRcdC8vICApfTtcclxuXHRcdFx0XHQvL1xyXG5cdFx0XHRcdGlmIChwYXJhbXMgJiYgKHBhcmFtcy5tZXNzYWdlIHx8IHBhcmFtcy5vbmx5SWYpKSB7IC8vaWYgaXQgaGFzIGEgbWVzc2FnZSBvciBjb25kaXRpb24gb2JqZWN0LCB0aGVuIGl0cyBhbiBvYmplY3QgbGl0ZXJhbCB0byB1c2VcclxuXHRcdFx0XHRcdHJldHVybiBrdi5hZGRSdWxlKG9ic2VydmFibGUsIHtcclxuXHRcdFx0XHRcdFx0cnVsZTogcnVsZU5hbWUsXHJcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IHBhcmFtcy5tZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRwYXJhbXM6IHV0aWxzLmlzRW1wdHlWYWwocGFyYW1zLnBhcmFtcykgPyB0cnVlIDogcGFyYW1zLnBhcmFtcyxcclxuXHRcdFx0XHRcdFx0Y29uZGl0aW9uOiBwYXJhbXMub25seUlmXHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGt2LmFkZFJ1bGUob2JzZXJ2YWJsZSwge1xyXG5cdFx0XHRcdFx0XHRydWxlOiBydWxlTmFtZSxcclxuXHRcdFx0XHRcdFx0cGFyYW1zOiBwYXJhbXNcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Ly8gbG9vcHMgdGhyb3VnaCBhbGwga3YucnVsZXMgYW5kIGFkZHMgdGhlbSBhcyBleHRlbmRlcnMgdG9cclxuXHRcdC8vIGtvLmV4dGVuZGVyc1xyXG5cdFx0cmVnaXN0ZXJFeHRlbmRlcnM6IGZ1bmN0aW9uICgpIHsgLy8gcm9vdCBleHRlbmRlcnMgb3B0aW9uYWwsIHVzZSAndmFsaWRhdGlvbicgZXh0ZW5kZXIgaWYgd291bGQgY2F1c2UgY29uZmxpY3RzXHJcblx0XHRcdGlmIChjb25maWd1cmF0aW9uLnJlZ2lzdGVyRXh0ZW5kZXJzKSB7XHJcblx0XHRcdFx0Zm9yICh2YXIgcnVsZU5hbWUgaW4ga3YucnVsZXMpIHtcclxuXHRcdFx0XHRcdGlmIChrdi5ydWxlcy5oYXNPd25Qcm9wZXJ0eShydWxlTmFtZSkpIHtcclxuXHRcdFx0XHRcdFx0aWYgKCFrby5leHRlbmRlcnNbcnVsZU5hbWVdKSB7XHJcblx0XHRcdFx0XHRcdFx0a3YuYWRkRXh0ZW5kZXIocnVsZU5hbWUpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9LFxyXG5cclxuXHRcdC8vY3JlYXRlcyBhIHNwYW4gbmV4dCB0byB0aGUgQGVsZW1lbnQgd2l0aCB0aGUgc3BlY2lmaWVkIGVycm9yIGNsYXNzXHJcblx0XHRpbnNlcnRWYWxpZGF0aW9uTWVzc2FnZTogZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuXHRcdFx0dmFyIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdTUEFOJyk7XHJcblx0XHRcdHNwYW4uY2xhc3NOYW1lID0gdXRpbHMuZ2V0Q29uZmlnT3B0aW9ucyhlbGVtZW50KS5lcnJvck1lc3NhZ2VDbGFzcztcclxuXHRcdFx0dXRpbHMuaW5zZXJ0QWZ0ZXIoZWxlbWVudCwgc3Bhbik7XHJcblx0XHRcdHJldHVybiBzcGFuO1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyBpZiBodG1sLTUgdmFsaWRhdGlvbiBhdHRyaWJ1dGVzIGhhdmUgYmVlbiBzcGVjaWZpZWQsIHRoaXMgcGFyc2VzXHJcblx0XHQvLyB0aGUgYXR0cmlidXRlcyBvbiBAZWxlbWVudFxyXG5cdFx0cGFyc2VJbnB1dFZhbGlkYXRpb25BdHRyaWJ1dGVzOiBmdW5jdGlvbiAoZWxlbWVudCwgdmFsdWVBY2Nlc3Nvcikge1xyXG5cdFx0XHRmb3JFYWNoKGt2LmNvbmZpZ3VyYXRpb24uaHRtbDVBdHRyaWJ1dGVzLCBmdW5jdGlvbiAoYXR0cikge1xyXG5cdFx0XHRcdGlmICh1dGlscy5oYXNBdHRyaWJ1dGUoZWxlbWVudCwgYXR0cikpIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgcGFyYW1zID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0cikgfHwgdHJ1ZTtcclxuXHJcblx0XHRcdFx0XHRpZiAoYXR0ciA9PT0gJ21pbicgfHwgYXR0ciA9PT0gJ21heCcpXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdC8vIElmIHdlJ3JlIHZhbGlkYXRpbmcgYmFzZWQgb24gdGhlIG1pbiBhbmQgbWF4IGF0dHJpYnV0ZXMsIHdlJ2xsXHJcblx0XHRcdFx0XHRcdC8vIG5lZWQgdG8ga25vdyB3aGF0IHRoZSAndHlwZScgYXR0cmlidXRlIGlzIHNldCB0b1xyXG5cdFx0XHRcdFx0XHR2YXIgdHlwZUF0dHIgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpO1xyXG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIHR5cGVBdHRyID09PSBcInVuZGVmaW5lZFwiIHx8ICF0eXBlQXR0cilcclxuXHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdC8vIEZyb20gaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbC1tYXJrdXAvaW5wdXQ6XHJcblx0XHRcdFx0XHRcdFx0Ly8gICBBbiBpbnB1dCBlbGVtZW50IHdpdGggbm8gdHlwZSBhdHRyaWJ1dGUgc3BlY2lmaWVkIHJlcHJlc2VudHMgdGhlXHJcblx0XHRcdFx0XHRcdFx0Ly8gICBzYW1lIHRoaW5nIGFzIGFuIGlucHV0IGVsZW1lbnQgd2l0aCBpdHMgdHlwZSBhdHRyaWJ1dGUgc2V0IHRvIFwidGV4dFwiLlxyXG5cdFx0XHRcdFx0XHRcdHR5cGVBdHRyID0gXCJ0ZXh0XCI7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cGFyYW1zID0ge3R5cGVBdHRyOiB0eXBlQXR0ciwgdmFsdWU6IHBhcmFtc307XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0a3YuYWRkUnVsZSh2YWx1ZUFjY2Vzc29yKCksIHtcclxuXHRcdFx0XHRcdFx0cnVsZTogYXR0cixcclxuXHRcdFx0XHRcdFx0cGFyYW1zOiBwYXJhbXNcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHR2YXIgY3VycmVudFR5cGUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgndHlwZScpO1xyXG5cdFx0XHRmb3JFYWNoKGt2LmNvbmZpZ3VyYXRpb24uaHRtbDVJbnB1dFR5cGVzLCBmdW5jdGlvbiAodHlwZSkge1xyXG5cdFx0XHRcdGlmICh0eXBlID09PSBjdXJyZW50VHlwZSkge1xyXG5cdFx0XHRcdFx0a3YuYWRkUnVsZSh2YWx1ZUFjY2Vzc29yKCksIHtcclxuXHRcdFx0XHRcdFx0cnVsZTogKHR5cGUgPT09ICdkYXRlJykgPyAnZGF0ZUlTTycgOiB0eXBlLFxyXG5cdFx0XHRcdFx0XHRwYXJhbXM6IHRydWVcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8vIHdyaXRlcyBodG1sNSB2YWxpZGF0aW9uIGF0dHJpYnV0ZXMgb24gdGhlIGVsZW1lbnQgcGFzc2VkIGluXHJcblx0XHR3cml0ZUlucHV0VmFsaWRhdGlvbkF0dHJpYnV0ZXM6IGZ1bmN0aW9uIChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yKSB7XHJcblx0XHRcdHZhciBvYnNlcnZhYmxlID0gdmFsdWVBY2Nlc3NvcigpO1xyXG5cclxuXHRcdFx0aWYgKCFvYnNlcnZhYmxlIHx8ICFvYnNlcnZhYmxlLnJ1bGVzKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY29udGV4dHMgPSBvYnNlcnZhYmxlLnJ1bGVzKCk7IC8vIG9ic2VydmFibGUgYXJyYXlcclxuXHJcblx0XHRcdC8vIGxvb3AgdGhyb3VnaCB0aGUgYXR0cmlidXRlcyBhbmQgYWRkIHRoZSBpbmZvcm1hdGlvbiBuZWVkZWRcclxuXHRcdFx0Zm9yRWFjaChrdi5jb25maWd1cmF0aW9uLmh0bWw1QXR0cmlidXRlcywgZnVuY3Rpb24gKGF0dHIpIHtcclxuXHRcdFx0XHR2YXIgY3R4ID0ga29VdGlscy5hcnJheUZpcnN0KGNvbnRleHRzLCBmdW5jdGlvbiAoY3R4KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gY3R4LnJ1bGUgJiYgY3R4LnJ1bGUudG9Mb3dlckNhc2UoKSA9PT0gYXR0ci50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHRpZiAoIWN0eCkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gd2UgaGF2ZSBhIHJ1bGUgbWF0Y2hpbmcgYSB2YWxpZGF0aW9uIGF0dHJpYnV0ZSBhdCB0aGlzIHBvaW50XHJcblx0XHRcdFx0Ly8gc28gbGV0cyBhZGQgaXQgdG8gdGhlIGVsZW1lbnQgYWxvbmcgd2l0aCB0aGUgcGFyYW1zXHJcblx0XHRcdFx0a28uY29tcHV0ZWQoe1xyXG5cdFx0XHRcdFx0cmVhZDogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRcdHZhciBwYXJhbXMgPSBrby51bndyYXAoY3R4LnBhcmFtcyk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyB3ZSBoYXZlIHRvIGRvIHNvbWUgc3BlY2lhbCB0aGluZ3MgZm9yIHRoZSBwYXR0ZXJuIHZhbGlkYXRpb25cclxuXHRcdFx0XHRcdFx0aWYgKGN0eC5ydWxlID09PSBcInBhdHRlcm5cIiAmJiBwYXJhbXMgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyB3ZSBuZWVkIHRoZSBwdXJlIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgUmVnRXhwciB3aXRob3V0IHRoZSAvL2dpIHN0dWZmXHJcblx0XHRcdFx0XHRcdFx0cGFyYW1zID0gcGFyYW1zLnNvdXJjZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoYXR0ciwgcGFyYW1zKTtcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRkaXNwb3NlV2hlbk5vZGVJc1JlbW92ZWQ6IGVsZW1lbnRcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb250ZXh0cyA9IG51bGw7XHJcblx0XHR9LFxyXG5cclxuXHRcdC8vdGFrZSBhbiBleGlzdGluZyBiaW5kaW5nIGhhbmRsZXIgYW5kIG1ha2UgaXQgY2F1c2UgYXV0b21hdGljIHZhbGlkYXRpb25zXHJcblx0XHRtYWtlQmluZGluZ0hhbmRsZXJWYWxpZGF0YWJsZTogZnVuY3Rpb24gKGhhbmRsZXJOYW1lKSB7XHJcblx0XHRcdHZhciBpbml0ID0ga28uYmluZGluZ0hhbmRsZXJzW2hhbmRsZXJOYW1lXS5pbml0O1xyXG5cclxuXHRcdFx0a28uYmluZGluZ0hhbmRsZXJzW2hhbmRsZXJOYW1lXS5pbml0ID0gZnVuY3Rpb24gKGVsZW1lbnQsIHZhbHVlQWNjZXNzb3IsIGFsbEJpbmRpbmdzQWNjZXNzb3IsIHZpZXdNb2RlbCwgYmluZGluZ0NvbnRleHQpIHtcclxuXHJcblx0XHRcdFx0aW5pdChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5nc0FjY2Vzc29yLCB2aWV3TW9kZWwsIGJpbmRpbmdDb250ZXh0KTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIGtvLmJpbmRpbmdIYW5kbGVyc1sndmFsaWRhdGlvbkNvcmUnXS5pbml0KGVsZW1lbnQsIHZhbHVlQWNjZXNzb3IsIGFsbEJpbmRpbmdzQWNjZXNzb3IsIHZpZXdNb2RlbCwgYmluZGluZ0NvbnRleHQpO1xyXG5cdFx0XHR9O1xyXG5cdFx0fSxcclxuXHJcblx0XHQvLyB2aXNpdCBhbiBvYmplY3RzIHByb3BlcnRpZXMgYW5kIGFwcGx5IHZhbGlkYXRpb24gcnVsZXMgZnJvbSBhIGRlZmluaXRpb25cclxuXHRcdHNldFJ1bGVzOiBmdW5jdGlvbiAodGFyZ2V0LCBkZWZpbml0aW9uKSB7XHJcblx0XHRcdHZhciBzZXRSdWxlcyA9IGZ1bmN0aW9uICh0YXJnZXQsIGRlZmluaXRpb24pIHtcclxuXHRcdFx0XHRpZiAoIXRhcmdldCB8fCAhZGVmaW5pdGlvbikgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0Zm9yICh2YXIgcHJvcCBpbiBkZWZpbml0aW9uKSB7XHJcblx0XHRcdFx0XHRpZiAoIWRlZmluaXRpb24uaGFzT3duUHJvcGVydHkocHJvcCkpIHsgY29udGludWU7IH1cclxuXHRcdFx0XHRcdHZhciBydWxlRGVmaW5pdGlvbnMgPSBkZWZpbml0aW9uW3Byb3BdO1xyXG5cclxuXHRcdFx0XHRcdC8vY2hlY2sgdGhlIHRhcmdldCBwcm9wZXJ0eSBleGlzdHMgYW5kIGhhcyBhIHZhbHVlXHJcblx0XHRcdFx0XHRpZiAoIXRhcmdldFtwcm9wXSkgeyBjb250aW51ZTsgfVxyXG5cdFx0XHRcdFx0dmFyIHRhcmdldFZhbHVlID0gdGFyZ2V0W3Byb3BdLFxyXG5cdFx0XHRcdFx0XHR1bndyYXBwZWRUYXJnZXRWYWx1ZSA9IHVud3JhcCh0YXJnZXRWYWx1ZSksXHJcblx0XHRcdFx0XHRcdHJ1bGVzID0ge30sXHJcblx0XHRcdFx0XHRcdG5vblJ1bGVzID0ge307XHJcblxyXG5cdFx0XHRcdFx0Zm9yICh2YXIgcnVsZSBpbiBydWxlRGVmaW5pdGlvbnMpIHtcclxuXHRcdFx0XHRcdFx0aWYgKCFydWxlRGVmaW5pdGlvbnMuaGFzT3duUHJvcGVydHkocnVsZSkpIHsgY29udGludWU7IH1cclxuXHRcdFx0XHRcdFx0aWYgKGt2LnJ1bGVzW3J1bGVdKSB7XHJcblx0XHRcdFx0XHRcdFx0cnVsZXNbcnVsZV0gPSBydWxlRGVmaW5pdGlvbnNbcnVsZV07XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0bm9uUnVsZXNbcnVsZV0gPSBydWxlRGVmaW5pdGlvbnNbcnVsZV07XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvL2FwcGx5IHJ1bGVzXHJcblx0XHRcdFx0XHRpZiAoa28uaXNPYnNlcnZhYmxlKHRhcmdldFZhbHVlKSkge1xyXG5cdFx0XHRcdFx0XHR0YXJnZXRWYWx1ZS5leHRlbmQocnVsZXMpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vdGhlbiBhcHBseSBjaGlsZCBydWxlc1xyXG5cdFx0XHRcdFx0Ly9pZiBpdCdzIGFuIGFycmF5LCBhcHBseSBydWxlcyB0byBhbGwgY2hpbGRyZW5cclxuXHRcdFx0XHRcdGlmICh1bndyYXBwZWRUYXJnZXRWYWx1ZSAmJiB1dGlscy5pc0FycmF5KHVud3JhcHBlZFRhcmdldFZhbHVlKSkge1xyXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHVud3JhcHBlZFRhcmdldFZhbHVlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRcdFx0c2V0UnVsZXModW53cmFwcGVkVGFyZ2V0VmFsdWVbaV0sIG5vblJ1bGVzKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHQvL290aGVyd2lzZSwganVzdCBhcHBseSB0byB0aGlzIHByb3BlcnR5XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRzZXRSdWxlcyh1bndyYXBwZWRUYXJnZXRWYWx1ZSwgbm9uUnVsZXMpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHRcdFx0c2V0UnVsZXModGFyZ2V0LCBkZWZpbml0aW9uKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxufSgpKTtcclxuXHJcbi8vIGV4cG9zZSBhcGkgcHVibGljbHlcclxuZXh0ZW5kKGtvLnZhbGlkYXRpb24sIGFwaSk7XHJcbjsvL1ZhbGlkYXRpb24gUnVsZXM6XHJcbi8vIFlvdSBjYW4gdmlldyBhbmQgb3ZlcnJpZGUgbWVzc2FnZXMgb3IgcnVsZXMgdmlhOlxyXG4vLyBrdi5ydWxlc1tydWxlTmFtZV1cclxuLy9cclxuLy8gVG8gaW1wbGVtZW50IGEgY3VzdG9tIFJ1bGUsIHNpbXBseSB1c2UgdGhpcyB0ZW1wbGF0ZTpcclxuLy8ga3YucnVsZXNbJzxjdXN0b20gcnVsZSBuYW1lPiddID0ge1xyXG4vLyAgICAgIHZhbGlkYXRvcjogZnVuY3Rpb24gKHZhbCwgcGFyYW0pIHtcclxuLy8gICAgICAgICAgPGN1c3RvbSBsb2dpYz5cclxuLy8gICAgICAgICAgcmV0dXJuIDx0cnVlIG9yIGZhbHNlPjtcclxuLy8gICAgICB9LFxyXG4vLyAgICAgIG1lc3NhZ2U6ICc8Y3VzdG9tIHZhbGlkYXRpb24gbWVzc2FnZT4nIC8vb3B0aW9uYWxseSB5b3UgY2FuIGFsc28gdXNlIGEgJ3swfScgdG8gZGVub3RlIGEgcGxhY2Vob2xkZXIgdGhhdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggeW91ciAncGFyYW0nXHJcbi8vIH07XHJcbi8vXHJcbi8vIEV4YW1wbGU6XHJcbi8vIGt2LnJ1bGVzWydtdXN0RXF1YWwnXSA9IHtcclxuLy8gICAgICB2YWxpZGF0b3I6IGZ1bmN0aW9uKCB2YWwsIG11c3RFcXVhbFZhbCApe1xyXG4vLyAgICAgICAgICByZXR1cm4gdmFsID09PSBtdXN0RXF1YWxWYWw7XHJcbi8vICAgICAgfSxcclxuLy8gICAgICBtZXNzYWdlOiAnVGhpcyBmaWVsZCBtdXN0IGVxdWFsIHswfSdcclxuLy8gfTtcclxuLy9cclxua3YucnVsZXMgPSB7fTtcclxua3YucnVsZXNbJ3JlcXVpcmVkJ10gPSB7XHJcblx0dmFsaWRhdG9yOiBmdW5jdGlvbiAodmFsLCByZXF1aXJlZCkge1xyXG5cdFx0dmFyIHRlc3RWYWw7XHJcblxyXG5cdFx0aWYgKHZhbCA9PT0gdW5kZWZpbmVkIHx8IHZhbCA9PT0gbnVsbCkge1xyXG5cdFx0XHRyZXR1cm4gIXJlcXVpcmVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRlc3RWYWwgPSB2YWw7XHJcblx0XHRpZiAodHlwZW9mICh2YWwpID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRpZiAoU3RyaW5nLnByb3RvdHlwZS50cmltKSB7XHJcblx0XHRcdFx0dGVzdFZhbCA9IHZhbC50cmltKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0dGVzdFZhbCA9IHZhbC5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJyk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXJlcXVpcmVkKSB7Ly8gaWYgdGhleSBwYXNzZWQ6IHsgcmVxdWlyZWQ6IGZhbHNlIH0sIHRoZW4gZG9uJ3QgcmVxdWlyZSB0aGlzXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAoKHRlc3RWYWwgKyAnJykubGVuZ3RoID4gMCk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnVGhpcyBmaWVsZCBpcyByZXF1aXJlZC4nXHJcbn07XHJcblxyXG5mdW5jdGlvbiBtaW5NYXhWYWxpZGF0b3JGYWN0b3J5KHZhbGlkYXRvck5hbWUpIHtcclxuXHR2YXIgaXNNYXhWYWxpZGF0aW9uID0gdmFsaWRhdG9yTmFtZSA9PT0gXCJtYXhcIjtcclxuXHJcblx0cmV0dXJuIGZ1bmN0aW9uICh2YWwsIG9wdGlvbnMpIHtcclxuXHRcdGlmIChrdi51dGlscy5pc0VtcHR5VmFsKHZhbCkpIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNvbXBhcmlzb25WYWx1ZSwgdHlwZTtcclxuXHRcdGlmIChvcHRpb25zLnR5cGVBdHRyID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0Ly8gVGhpcyB2YWxpZGF0b3IgaXMgYmVpbmcgY2FsbGVkIGZyb20gamF2YXNjcmlwdCByYXRoZXIgdGhhblxyXG5cdFx0XHQvLyBiZWluZyBib3VuZCBmcm9tIG1hcmt1cFxyXG5cdFx0XHR0eXBlID0gXCJ0ZXh0XCI7XHJcblx0XHRcdGNvbXBhcmlzb25WYWx1ZSA9IG9wdGlvbnM7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0eXBlID0gb3B0aW9ucy50eXBlQXR0cjtcclxuXHRcdFx0Y29tcGFyaXNvblZhbHVlID0gb3B0aW9ucy52YWx1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBGcm9tIGh0dHA6Ly93d3cudzMub3JnL1RSLzIwMTIvV0QtaHRtbDUtMjAxMjEwMjUvY29tbW9uLWlucHV0LWVsZW1lbnQtYXR0cmlidXRlcy5odG1sI2F0dHItaW5wdXQtbWluLFxyXG5cdFx0Ly8gaWYgdGhlIHZhbHVlIGlzIHBhcnNlYWJsZSB0byBhIG51bWJlciwgdGhlbiB0aGUgbWluaW11bSBzaG91bGQgYmUgbnVtZXJpY1xyXG5cdFx0aWYgKCFpc05hTihjb21wYXJpc29uVmFsdWUpICYmICEoY29tcGFyaXNvblZhbHVlIGluc3RhbmNlb2YgRGF0ZSkpIHtcclxuXHRcdFx0dHlwZSA9IFwibnVtYmVyXCI7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHJlZ2V4LCB2YWxNYXRjaGVzLCBjb21wYXJpc29uVmFsdWVNYXRjaGVzO1xyXG5cdFx0c3dpdGNoICh0eXBlLnRvTG93ZXJDYXNlKCkpIHtcclxuXHRcdFx0Y2FzZSBcIndlZWtcIjpcclxuXHRcdFx0XHRyZWdleCA9IC9eKFxcZHs0fSktVyhcXGR7Mn0pJC87XHJcblx0XHRcdFx0dmFsTWF0Y2hlcyA9IHZhbC5tYXRjaChyZWdleCk7XHJcblx0XHRcdFx0aWYgKHZhbE1hdGNoZXMgPT09IG51bGwpIHtcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgdmFsdWUgZm9yIFwiICsgdmFsaWRhdG9yTmFtZSArIFwiIGF0dHJpYnV0ZSBmb3Igd2VlayBpbnB1dC4gIFNob3VsZCBsb29rIGxpa2UgXCIgK1xyXG5cdFx0XHRcdFx0XHRcIicyMDAwLVczMycgaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbC1tYXJrdXAvaW5wdXQud2Vlay5odG1sI2lucHV0LndlZWsuYXR0cnMubWluXCIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb21wYXJpc29uVmFsdWVNYXRjaGVzID0gY29tcGFyaXNvblZhbHVlLm1hdGNoKHJlZ2V4KTtcclxuXHRcdFx0XHQvLyBJZiBubyByZWdleCBtYXRjaGVzIHdlcmUgZm91bmQsIHZhbGlkYXRpb24gZmFpbHNcclxuXHRcdFx0XHRpZiAoIWNvbXBhcmlzb25WYWx1ZU1hdGNoZXMpIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChpc01heFZhbGlkYXRpb24pIHtcclxuXHRcdFx0XHRcdHJldHVybiAodmFsTWF0Y2hlc1sxXSA8IGNvbXBhcmlzb25WYWx1ZU1hdGNoZXNbMV0pIHx8IC8vIG9sZGVyIHllYXJcclxuXHRcdFx0XHRcdFx0Ly8gc2FtZSB5ZWFyLCBvbGRlciB3ZWVrXHJcblx0XHRcdFx0XHRcdCgodmFsTWF0Y2hlc1sxXSA9PT0gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1sxXSkgJiYgKHZhbE1hdGNoZXNbMl0gPD0gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1syXSkpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gKHZhbE1hdGNoZXNbMV0gPiBjb21wYXJpc29uVmFsdWVNYXRjaGVzWzFdKSB8fCAvLyBuZXdlciB5ZWFyXHJcblx0XHRcdFx0XHRcdC8vIHNhbWUgeWVhciwgbmV3ZXIgd2Vla1xyXG5cdFx0XHRcdFx0XHQoKHZhbE1hdGNoZXNbMV0gPT09IGNvbXBhcmlzb25WYWx1ZU1hdGNoZXNbMV0pICYmICh2YWxNYXRjaGVzWzJdID49IGNvbXBhcmlzb25WYWx1ZU1hdGNoZXNbMl0pKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlIFwibW9udGhcIjpcclxuXHRcdFx0XHRyZWdleCA9IC9eKFxcZHs0fSktKFxcZHsyfSkkLztcclxuXHRcdFx0XHR2YWxNYXRjaGVzID0gdmFsLm1hdGNoKHJlZ2V4KTtcclxuXHRcdFx0XHRpZiAodmFsTWF0Y2hlcyA9PT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCB2YWx1ZSBmb3IgXCIgKyB2YWxpZGF0b3JOYW1lICsgXCIgYXR0cmlidXRlIGZvciBtb250aCBpbnB1dC4gIFNob3VsZCBsb29rIGxpa2UgXCIgK1xyXG5cdFx0XHRcdFx0XHRcIicyMDAwLTAzJyBodHRwOi8vd3d3LnczLm9yZy9UUi9odG1sLW1hcmt1cC9pbnB1dC5tb250aC5odG1sI2lucHV0Lm1vbnRoLmF0dHJzLm1pblwiKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29tcGFyaXNvblZhbHVlTWF0Y2hlcyA9IGNvbXBhcmlzb25WYWx1ZS5tYXRjaChyZWdleCk7XHJcblx0XHRcdFx0Ly8gSWYgbm8gcmVnZXggbWF0Y2hlcyB3ZXJlIGZvdW5kLCB2YWxpZGF0aW9uIGZhaWxzXHJcblx0XHRcdFx0aWYgKCFjb21wYXJpc29uVmFsdWVNYXRjaGVzKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaXNNYXhWYWxpZGF0aW9uKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gKCh2YWxNYXRjaGVzWzFdIDwgY29tcGFyaXNvblZhbHVlTWF0Y2hlc1sxXSkgfHwgLy8gb2xkZXIgeWVhclxyXG5cdFx0XHRcdFx0XHQvLyBzYW1lIHllYXIsIG9sZGVyIG1vbnRoXHJcblx0XHRcdFx0XHRcdCgodmFsTWF0Y2hlc1sxXSA9PT0gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1sxXSkgJiYgKHZhbE1hdGNoZXNbMl0gPD0gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1syXSkpKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmV0dXJuICh2YWxNYXRjaGVzWzFdID4gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1sxXSkgfHwgLy8gbmV3ZXIgeWVhclxyXG5cdFx0XHRcdFx0XHQvLyBzYW1lIHllYXIsIG5ld2VyIG1vbnRoXHJcblx0XHRcdFx0XHRcdCgodmFsTWF0Y2hlc1sxXSA9PT0gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1sxXSkgJiYgKHZhbE1hdGNoZXNbMl0gPj0gY29tcGFyaXNvblZhbHVlTWF0Y2hlc1syXSkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgXCJudW1iZXJcIjpcclxuXHRcdFx0Y2FzZSBcInJhbmdlXCI6XHJcblx0XHRcdFx0aWYgKGlzTWF4VmFsaWRhdGlvbikge1xyXG5cdFx0XHRcdFx0cmV0dXJuICghaXNOYU4odmFsKSAmJiBwYXJzZUZsb2F0KHZhbCkgPD0gcGFyc2VGbG9hdChjb21wYXJpc29uVmFsdWUpKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmV0dXJuICghaXNOYU4odmFsKSAmJiBwYXJzZUZsb2F0KHZhbCkgPj0gcGFyc2VGbG9hdChjb21wYXJpc29uVmFsdWUpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdGlmIChpc01heFZhbGlkYXRpb24pIHtcclxuXHRcdFx0XHRcdHJldHVybiB2YWwgPD0gY29tcGFyaXNvblZhbHVlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdmFsID49IGNvbXBhcmlzb25WYWx1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxufVxyXG5cclxua3YucnVsZXNbJ21pbiddID0ge1xyXG5cdHZhbGlkYXRvcjogbWluTWF4VmFsaWRhdG9yRmFjdG9yeShcIm1pblwiKSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIGVudGVyIGEgdmFsdWUgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIHswfS4nXHJcbn07XHJcblxyXG5rdi5ydWxlc1snbWF4J10gPSB7XHJcblx0dmFsaWRhdG9yOiBtaW5NYXhWYWxpZGF0b3JGYWN0b3J5KFwibWF4XCIpLFxyXG5cdG1lc3NhZ2U6ICdQbGVhc2UgZW50ZXIgYSB2YWx1ZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gezB9LidcclxufTtcclxuXHJcbmt2LnJ1bGVzWydtaW5MZW5ndGgnXSA9IHtcclxuXHR2YWxpZGF0b3I6IGZ1bmN0aW9uICh2YWwsIG1pbkxlbmd0aCkge1xyXG5cdFx0aWYoa3YudXRpbHMuaXNFbXB0eVZhbCh2YWwpKSB7IHJldHVybiB0cnVlOyB9XHJcblx0XHR2YXIgbm9ybWFsaXplZFZhbCA9IGt2LnV0aWxzLmlzTnVtYmVyKHZhbCkgPyAoJycgKyB2YWwpIDogdmFsO1xyXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRWYWwubGVuZ3RoID49IG1pbkxlbmd0aDtcclxuXHR9LFxyXG5cdG1lc3NhZ2U6ICdQbGVhc2UgZW50ZXIgYXQgbGVhc3QgezB9IGNoYXJhY3RlcnMuJ1xyXG59O1xyXG5cclxua3YucnVsZXNbJ21heExlbmd0aCddID0ge1xyXG5cdHZhbGlkYXRvcjogZnVuY3Rpb24gKHZhbCwgbWF4TGVuZ3RoKSB7XHJcblx0XHRpZihrdi51dGlscy5pc0VtcHR5VmFsKHZhbCkpIHsgcmV0dXJuIHRydWU7IH1cclxuXHRcdHZhciBub3JtYWxpemVkVmFsID0ga3YudXRpbHMuaXNOdW1iZXIodmFsKSA/ICgnJyArIHZhbCkgOiB2YWw7XHJcblx0XHRyZXR1cm4gbm9ybWFsaXplZFZhbC5sZW5ndGggPD0gbWF4TGVuZ3RoO1xyXG5cdH0sXHJcblx0bWVzc2FnZTogJ1BsZWFzZSBlbnRlciBubyBtb3JlIHRoYW4gezB9IGNoYXJhY3RlcnMuJ1xyXG59O1xyXG5cclxua3YucnVsZXNbJ3BhdHRlcm4nXSA9IHtcclxuXHR2YWxpZGF0b3I6IGZ1bmN0aW9uICh2YWwsIHJlZ2V4KSB7XHJcblx0XHRyZXR1cm4ga3YudXRpbHMuaXNFbXB0eVZhbCh2YWwpIHx8IHZhbC50b1N0cmluZygpLm1hdGNoKHJlZ2V4KSAhPT0gbnVsbDtcclxuXHR9LFxyXG5cdG1lc3NhZ2U6ICdQbGVhc2UgY2hlY2sgdGhpcyB2YWx1ZS4nXHJcbn07XHJcblxyXG5rdi5ydWxlc1snc3RlcCddID0ge1xyXG5cdHZhbGlkYXRvcjogZnVuY3Rpb24gKHZhbCwgc3RlcCkge1xyXG5cclxuXHRcdC8vIGluIG9yZGVyIHRvIGhhbmRsZSBzdGVwcyBvZiAuMSAmIC4wMSBldGMuLiBNb2R1bHVzIHdvbid0IHdvcmtcclxuXHRcdC8vIGlmIHRoZSB2YWx1ZSBpcyBhIGRlY2ltYWwsIHNvIHdlIGhhdmUgdG8gY29ycmVjdCBmb3IgdGhhdFxyXG5cdFx0aWYgKGt2LnV0aWxzLmlzRW1wdHlWYWwodmFsKSB8fCBzdGVwID09PSAnYW55JykgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cdFx0dmFyIGRpZiA9ICh2YWwgKiAxMDApICUgKHN0ZXAgKiAxMDApO1xyXG5cdFx0cmV0dXJuIE1hdGguYWJzKGRpZikgPCAwLjAwMDAxIHx8IE1hdGguYWJzKDEgLSBkaWYpIDwgMC4wMDAwMTtcclxuXHR9LFxyXG5cdG1lc3NhZ2U6ICdUaGUgdmFsdWUgbXVzdCBpbmNyZW1lbnQgYnkgezB9LidcclxufTtcclxuXHJcbmt2LnJ1bGVzWydlbWFpbCddID0ge1xyXG5cdHZhbGlkYXRvcjogZnVuY3Rpb24gKHZhbCwgdmFsaWRhdGUpIHtcclxuXHRcdGlmICghdmFsaWRhdGUpIHsgcmV0dXJuIHRydWU7IH1cclxuXHJcblx0XHQvL0kgdGhpbmsgYW4gZW1wdHkgZW1haWwgYWRkcmVzcyBpcyBhbHNvIGEgdmFsaWQgZW50cnlcclxuXHRcdC8vaWYgb25lIHdhbnQncyB0byBlbmZvcmNlIGVudHJ5IGl0IHNob3VsZCBiZSBkb25lIHdpdGggJ3JlcXVpcmVkOiB0cnVlJ1xyXG5cdFx0cmV0dXJuIGt2LnV0aWxzLmlzRW1wdHlWYWwodmFsKSB8fCAoXHJcblx0XHRcdC8vIGpxdWVyeSB2YWxpZGF0ZSByZWdleCAtIHRoYW5rcyBTY290dCBHb256YWxlelxyXG5cdFx0XHR2YWxpZGF0ZSAmJiAvXigoKFthLXpdfFxcZHxbISNcXCQlJidcXCpcXCtcXC1cXC89XFw/XFxeX2B7XFx8fX5dfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSsoXFwuKFthLXpdfFxcZHxbISNcXCQlJidcXCpcXCtcXC1cXC89XFw/XFxeX2B7XFx8fX5dfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSspKil8KChcXHgyMikoKCgoXFx4MjB8XFx4MDkpKihcXHgwZFxceDBhKSk/KFxceDIwfFxceDA5KSspPygoW1xceDAxLVxceDA4XFx4MGJcXHgwY1xceDBlLVxceDFmXFx4N2ZdfFxceDIxfFtcXHgyMy1cXHg1Yl18W1xceDVkLVxceDdlXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSl8KFxcXFwoW1xceDAxLVxceDA5XFx4MGJcXHgwY1xceDBkLVxceDdmXXxbXFx1MDBBMC1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkVGXSkpKSkqKCgoXFx4MjB8XFx4MDkpKihcXHgwZFxceDBhKSk/KFxceDIwfFxceDA5KSspPyhcXHgyMikpKUAoKChbYS16XXxcXGR8W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pfCgoW2Etel18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKShbYS16XXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSooW2Etel18XFxkfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSkpXFwuKSsoKFthLXpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKXwoKFthLXpdfFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKShbYS16XXxcXGR8LXxcXC58X3x+fFtcXHUwMEEwLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRUZdKSooW2Etel18W1xcdTAwQTAtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZFRl0pKSkkL2kudGVzdCh2YWwpXHJcblx0XHQpO1xyXG5cdH0sXHJcblx0bWVzc2FnZTogJ1BsZWFzZSBlbnRlciBhIHByb3BlciBlbWFpbCBhZGRyZXNzLidcclxufTtcclxuXHJcbmt2LnJ1bGVzWydkYXRlJ10gPSB7XHJcblx0dmFsaWRhdG9yOiBmdW5jdGlvbiAodmFsdWUsIHZhbGlkYXRlKSB7XHJcblx0XHRpZiAoIXZhbGlkYXRlKSB7IHJldHVybiB0cnVlOyB9XHJcblx0XHRyZXR1cm4ga3YudXRpbHMuaXNFbXB0eVZhbCh2YWx1ZSkgfHwgKHZhbGlkYXRlICYmICEvSW52YWxpZHxOYU4vLnRlc3QobmV3IERhdGUodmFsdWUpKSk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIGVudGVyIGEgcHJvcGVyIGRhdGUuJ1xyXG59O1xyXG5cclxua3YucnVsZXNbJ2RhdGVJU08nXSA9IHtcclxuXHR2YWxpZGF0b3I6IGZ1bmN0aW9uICh2YWx1ZSwgdmFsaWRhdGUpIHtcclxuXHRcdGlmICghdmFsaWRhdGUpIHsgcmV0dXJuIHRydWU7IH1cclxuXHRcdHJldHVybiBrdi51dGlscy5pc0VtcHR5VmFsKHZhbHVlKSB8fCAodmFsaWRhdGUgJiYgL15cXGR7NH1bLS9dKD86MD9bMS05XXwxWzAxMl0pWy0vXSg/OjA/WzEtOV18WzEyXVswLTldfDNbMDFdKSQvLnRlc3QodmFsdWUpKTtcclxuXHR9LFxyXG5cdG1lc3NhZ2U6ICdQbGVhc2UgZW50ZXIgYSBwcm9wZXIgZGF0ZS4nXHJcbn07XHJcblxyXG5rdi5ydWxlc1snbnVtYmVyJ10gPSB7XHJcblx0dmFsaWRhdG9yOiBmdW5jdGlvbiAodmFsdWUsIHZhbGlkYXRlKSB7XHJcblx0XHRpZiAoIXZhbGlkYXRlKSB7IHJldHVybiB0cnVlOyB9XHJcblx0XHRyZXR1cm4ga3YudXRpbHMuaXNFbXB0eVZhbCh2YWx1ZSkgfHwgKHZhbGlkYXRlICYmIC9eLT8oPzpcXGQrfFxcZHsxLDN9KD86LFxcZHszfSkrKT8oPzpcXC5cXGQrKT8kLy50ZXN0KHZhbHVlKSk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIGVudGVyIGEgbnVtYmVyLidcclxufTtcclxuXHJcbmt2LnJ1bGVzWydkaWdpdCddID0ge1xyXG5cdHZhbGlkYXRvcjogZnVuY3Rpb24gKHZhbHVlLCB2YWxpZGF0ZSkge1xyXG5cdFx0aWYgKCF2YWxpZGF0ZSkgeyByZXR1cm4gdHJ1ZTsgfVxyXG5cdFx0cmV0dXJuIGt2LnV0aWxzLmlzRW1wdHlWYWwodmFsdWUpIHx8ICh2YWxpZGF0ZSAmJiAvXlxcZCskLy50ZXN0KHZhbHVlKSk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIGVudGVyIGEgZGlnaXQuJ1xyXG59O1xyXG5cclxua3YucnVsZXNbJ3Bob25lVVMnXSA9IHtcclxuXHR2YWxpZGF0b3I6IGZ1bmN0aW9uIChwaG9uZU51bWJlciwgdmFsaWRhdGUpIHtcclxuXHRcdGlmICghdmFsaWRhdGUpIHsgcmV0dXJuIHRydWU7IH1cclxuXHRcdGlmIChrdi51dGlscy5pc0VtcHR5VmFsKHBob25lTnVtYmVyKSkgeyByZXR1cm4gdHJ1ZTsgfSAvLyBtYWtlcyBpdCBvcHRpb25hbCwgdXNlICdyZXF1aXJlZCcgcnVsZSBpZiBpdCBzaG91bGQgYmUgcmVxdWlyZWRcclxuXHRcdGlmICh0eXBlb2YgKHBob25lTnVtYmVyKSAhPT0gJ3N0cmluZycpIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0XHRwaG9uZU51bWJlciA9IHBob25lTnVtYmVyLnJlcGxhY2UoL1xccysvZywgXCJcIik7XHJcblx0XHRyZXR1cm4gdmFsaWRhdGUgJiYgcGhvbmVOdW1iZXIubGVuZ3RoID4gOSAmJiBwaG9uZU51bWJlci5tYXRjaCgvXigxLT8pPyhcXChbMi05XVxcZHsyfVxcKXxbMi05XVxcZHsyfSktP1syLTldXFxkezJ9LT9cXGR7NH0kLyk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIHNwZWNpZnkgYSB2YWxpZCBwaG9uZSBudW1iZXIuJ1xyXG59O1xyXG5cclxua3YucnVsZXNbJ2VxdWFsJ10gPSB7XHJcblx0dmFsaWRhdG9yOiBmdW5jdGlvbiAodmFsLCBwYXJhbXMpIHtcclxuXHRcdHZhciBvdGhlclZhbHVlID0gcGFyYW1zO1xyXG5cdFx0cmV0dXJuIHZhbCA9PT0ga3YudXRpbHMuZ2V0VmFsdWUob3RoZXJWYWx1ZSk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnVmFsdWVzIG11c3QgZXF1YWwuJ1xyXG59O1xyXG5cclxua3YucnVsZXNbJ25vdEVxdWFsJ10gPSB7XHJcblx0dmFsaWRhdG9yOiBmdW5jdGlvbiAodmFsLCBwYXJhbXMpIHtcclxuXHRcdHZhciBvdGhlclZhbHVlID0gcGFyYW1zO1xyXG5cdFx0cmV0dXJuIHZhbCAhPT0ga3YudXRpbHMuZ2V0VmFsdWUob3RoZXJWYWx1ZSk7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIGNob29zZSBhbm90aGVyIHZhbHVlLidcclxufTtcclxuXHJcbi8vdW5pcXVlIGluIGNvbGxlY3Rpb25cclxuLy8gb3B0aW9ucyBhcmU6XHJcbi8vICAgIGNvbGxlY3Rpb246IGFycmF5IG9yIGZ1bmN0aW9uIHJldHVybmluZyAob2JzZXJ2YWJsZSkgYXJyYXlcclxuLy8gICAgICAgICAgICAgIGluIHdoaWNoIHRoZSB2YWx1ZSBoYXMgdG8gYmUgdW5pcXVlXHJcbi8vICAgIHZhbHVlQWNjZXNzb3I6IGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB2YWx1ZSBmcm9tIGFuIG9iamVjdCBzdG9yZWQgaW4gY29sbGVjdGlvblxyXG4vLyAgICAgICAgICAgICAgaWYgaXQgaXMgbnVsbCB0aGUgdmFsdWUgaXMgY29tcGFyZWQgZGlyZWN0bHlcclxuLy8gICAgZXh0ZXJuYWw6IHNldCB0byB0cnVlIHdoZW4gb2JqZWN0IHlvdSBhcmUgdmFsaWRhdGluZyBpcyBhdXRvbWF0aWNhbGx5IHVwZGF0aW5nIGNvbGxlY3Rpb25cclxua3YucnVsZXNbJ3VuaXF1ZSddID0ge1xyXG5cdHZhbGlkYXRvcjogZnVuY3Rpb24gKHZhbCwgb3B0aW9ucykge1xyXG5cdFx0dmFyIGMgPSBrdi51dGlscy5nZXRWYWx1ZShvcHRpb25zLmNvbGxlY3Rpb24pLFxyXG5cdFx0XHRleHRlcm5hbCA9IGt2LnV0aWxzLmdldFZhbHVlKG9wdGlvbnMuZXh0ZXJuYWxWYWx1ZSksXHJcblx0XHRcdGNvdW50ZXIgPSAwO1xyXG5cclxuXHRcdGlmICghdmFsIHx8ICFjKSB7IHJldHVybiB0cnVlOyB9XHJcblxyXG5cdFx0a29VdGlscy5hcnJheUZpbHRlcihjLCBmdW5jdGlvbiAoaXRlbSkge1xyXG5cdFx0XHRpZiAodmFsID09PSAob3B0aW9ucy52YWx1ZUFjY2Vzc29yID8gb3B0aW9ucy52YWx1ZUFjY2Vzc29yKGl0ZW0pIDogaXRlbSkpIHsgY291bnRlcisrOyB9XHJcblx0XHR9KTtcclxuXHRcdC8vIGlmIHZhbHVlIGlzIGV4dGVybmFsIGV2ZW4gMSBzYW1lIHZhbHVlIGluIGNvbGxlY3Rpb24gbWVhbnMgdGhlIHZhbHVlIGlzIG5vdCB1bmlxdWVcclxuXHRcdHJldHVybiBjb3VudGVyIDwgKCEhZXh0ZXJuYWwgPyAxIDogMik7XHJcblx0fSxcclxuXHRtZXNzYWdlOiAnUGxlYXNlIG1ha2Ugc3VyZSB0aGUgdmFsdWUgaXMgdW5pcXVlLidcclxufTtcclxuXHJcblxyXG4vL25vdyByZWdpc3RlciBhbGwgb2YgdGhlc2UhXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0a3YucmVnaXN0ZXJFeHRlbmRlcnMoKTtcclxufSgpKTtcclxuOy8vIFRoZSBjb3JlIGJpbmRpbmcgaGFuZGxlclxyXG4vLyB0aGlzIGFsbG93cyB1cyB0byBzZXR1cCBhbnkgdmFsdWUgYmluZGluZyB0aGF0IGludGVybmFsbHkgYWx3YXlzXHJcbi8vIHBlcmZvcm1zIHRoZSBzYW1lIGZ1bmN0aW9uYWxpdHlcclxua28uYmluZGluZ0hhbmRsZXJzWyd2YWxpZGF0aW9uQ29yZSddID0gKGZ1bmN0aW9uICgpIHtcclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdGluaXQ6IGZ1bmN0aW9uIChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5nc0FjY2Vzc29yLCB2aWV3TW9kZWwsIGJpbmRpbmdDb250ZXh0KSB7XHJcblx0XHRcdHZhciBjb25maWcgPSBrdi51dGlscy5nZXRDb25maWdPcHRpb25zKGVsZW1lbnQpO1xyXG5cdFx0XHR2YXIgb2JzZXJ2YWJsZSA9IHZhbHVlQWNjZXNzb3IoKTtcclxuXHJcblx0XHRcdC8vIHBhcnNlIGh0bWw1IGlucHV0IHZhbGlkYXRpb24gYXR0cmlidXRlcywgb3B0aW9uYWwgZmVhdHVyZVxyXG5cdFx0XHRpZiAoY29uZmlnLnBhcnNlSW5wdXRBdHRyaWJ1dGVzKSB7XHJcblx0XHRcdFx0a3YudXRpbHMuYXN5bmMoZnVuY3Rpb24gKCkgeyBrdi5wYXJzZUlucHV0VmFsaWRhdGlvbkF0dHJpYnV0ZXMoZWxlbWVudCwgdmFsdWVBY2Nlc3Nvcik7IH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBpZiByZXF1ZXN0ZWQgaW5zZXJ0IG1lc3NhZ2UgZWxlbWVudCBhbmQgYXBwbHkgYmluZGluZ3NcclxuXHRcdFx0aWYgKGNvbmZpZy5pbnNlcnRNZXNzYWdlcyAmJiBrdi51dGlscy5pc1ZhbGlkYXRhYmxlKG9ic2VydmFibGUpKSB7XHJcblxyXG5cdFx0XHRcdC8vIGluc2VydCB0aGUgPHNwYW4+PC9zcGFuPlxyXG5cdFx0XHRcdHZhciB2YWxpZGF0aW9uTWVzc2FnZUVsZW1lbnQgPSBrdi5pbnNlcnRWYWxpZGF0aW9uTWVzc2FnZShlbGVtZW50KTtcclxuXHJcblx0XHRcdFx0Ly8gaWYgd2UncmUgdG9sZCB0byB1c2UgYSB0ZW1wbGF0ZSwgbWFrZSBzdXJlIHRoYXQgZ2V0cyByZW5kZXJlZFxyXG5cdFx0XHRcdGlmIChjb25maWcubWVzc2FnZVRlbXBsYXRlKSB7XHJcblx0XHRcdFx0XHRrby5yZW5kZXJUZW1wbGF0ZShjb25maWcubWVzc2FnZVRlbXBsYXRlLCB7IGZpZWxkOiBvYnNlcnZhYmxlIH0sIG51bGwsIHZhbGlkYXRpb25NZXNzYWdlRWxlbWVudCwgJ3JlcGxhY2VOb2RlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGtvLmFwcGx5QmluZGluZ3NUb05vZGUodmFsaWRhdGlvbk1lc3NhZ2VFbGVtZW50LCB7IHZhbGlkYXRpb25NZXNzYWdlOiBvYnNlcnZhYmxlIH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gd3JpdGUgdGhlIGh0bWw1IGF0dHJpYnV0ZXMgaWYgaW5kaWNhdGVkIGJ5IHRoZSBjb25maWdcclxuXHRcdFx0aWYgKGNvbmZpZy53cml0ZUlucHV0QXR0cmlidXRlcyAmJiBrdi51dGlscy5pc1ZhbGlkYXRhYmxlKG9ic2VydmFibGUpKSB7XHJcblxyXG5cdFx0XHRcdGt2LndyaXRlSW5wdXRWYWxpZGF0aW9uQXR0cmlidXRlcyhlbGVtZW50LCB2YWx1ZUFjY2Vzc29yKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gaWYgcmVxdWVzdGVkLCBhZGQgYmluZGluZyB0byBkZWNvcmF0ZSBlbGVtZW50XHJcblx0XHRcdGlmIChjb25maWcuZGVjb3JhdGVJbnB1dEVsZW1lbnQgJiYga3YudXRpbHMuaXNWYWxpZGF0YWJsZShvYnNlcnZhYmxlKSkge1xyXG5cdFx0XHRcdGtvLmFwcGx5QmluZGluZ3NUb05vZGUoZWxlbWVudCwgeyB2YWxpZGF0aW9uRWxlbWVudDogb2JzZXJ2YWJsZSB9KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG59KCkpO1xyXG5cclxuLy8gb3ZlcnJpZGUgZm9yIEtPJ3MgZGVmYXVsdCAndmFsdWUnLCAnY2hlY2tlZCcsICd0ZXh0SW5wdXQnIGFuZCBzZWxlY3RlZE9wdGlvbnMgYmluZGluZ3Ncclxua3YubWFrZUJpbmRpbmdIYW5kbGVyVmFsaWRhdGFibGUoXCJ2YWx1ZVwiKTtcclxua3YubWFrZUJpbmRpbmdIYW5kbGVyVmFsaWRhdGFibGUoXCJjaGVja2VkXCIpO1xyXG5pZiAoa28uYmluZGluZ0hhbmRsZXJzLnRleHRJbnB1dCkge1xyXG5cdGt2Lm1ha2VCaW5kaW5nSGFuZGxlclZhbGlkYXRhYmxlKFwidGV4dElucHV0XCIpO1xyXG59XHJcbmt2Lm1ha2VCaW5kaW5nSGFuZGxlclZhbGlkYXRhYmxlKFwic2VsZWN0ZWRPcHRpb25zXCIpO1xyXG5cclxuXHJcbmtvLmJpbmRpbmdIYW5kbGVyc1sndmFsaWRhdGlvbk1lc3NhZ2UnXSA9IHsgLy8gaW5kaXZpZHVhbCBlcnJvciBtZXNzYWdlLCBpZiBtb2RpZmllZCBvciBwb3N0IGJpbmRpbmdcclxuXHR1cGRhdGU6IGZ1bmN0aW9uIChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yKSB7XHJcblx0XHR2YXIgb2JzdiA9IHZhbHVlQWNjZXNzb3IoKSxcclxuXHRcdFx0Y29uZmlnID0ga3YudXRpbHMuZ2V0Q29uZmlnT3B0aW9ucyhlbGVtZW50KSxcclxuXHRcdFx0dmFsID0gdW53cmFwKG9ic3YpLFxyXG5cdFx0XHRtc2cgPSBudWxsLFxyXG5cdFx0XHRpc01vZGlmaWVkID0gZmFsc2UsXHJcblx0XHRcdGlzVmFsaWQgPSBmYWxzZTtcclxuXHJcblx0XHRpZiAob2JzdiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JzdiA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB2YWxpZGF0aW9uTWVzc2FnZSB0byB1bmRlZmluZWQgdmFsdWUuIGRhdGEtYmluZCBleHByZXNzaW9uOiAnICtcclxuXHRcdFx0XHRlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1iaW5kJykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlzTW9kaWZpZWQgPSBvYnN2LmlzTW9kaWZpZWQgJiYgb2Jzdi5pc01vZGlmaWVkKCk7XHJcblx0XHRpc1ZhbGlkID0gb2Jzdi5pc1ZhbGlkICYmIG9ic3YuaXNWYWxpZCgpO1xyXG5cclxuXHRcdHZhciBlcnJvciA9IG51bGw7XHJcblx0XHRpZiAoIWNvbmZpZy5tZXNzYWdlc09uTW9kaWZpZWQgfHwgaXNNb2RpZmllZCkge1xyXG5cdFx0XHRlcnJvciA9IGlzVmFsaWQgPyBudWxsIDogb2Jzdi5lcnJvcjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgaXNWaXNpYmxlID0gIWNvbmZpZy5tZXNzYWdlc09uTW9kaWZpZWQgfHwgaXNNb2RpZmllZCA/ICFpc1ZhbGlkIDogZmFsc2U7XHJcblx0XHR2YXIgaXNDdXJyZW50bHlWaXNpYmxlID0gZWxlbWVudC5zdHlsZS5kaXNwbGF5ICE9PSBcIm5vbmVcIjtcclxuXHJcblx0XHRpZiAoY29uZmlnLmFsbG93SHRtbE1lc3NhZ2VzKSB7XHJcblx0XHRcdGtvVXRpbHMuc2V0SHRtbChlbGVtZW50LCBlcnJvcik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRrby5iaW5kaW5nSGFuZGxlcnMudGV4dC51cGRhdGUoZWxlbWVudCwgZnVuY3Rpb24gKCkgeyByZXR1cm4gZXJyb3I7IH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChpc0N1cnJlbnRseVZpc2libGUgJiYgIWlzVmlzaWJsZSkge1xyXG5cdFx0XHRlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHR9IGVsc2UgaWYgKCFpc0N1cnJlbnRseVZpc2libGUgJiYgaXNWaXNpYmxlKSB7XHJcblx0XHRcdGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbmtvLmJpbmRpbmdIYW5kbGVyc1sndmFsaWRhdGlvbkVsZW1lbnQnXSA9IHtcclxuXHR1cGRhdGU6IGZ1bmN0aW9uIChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5nc0FjY2Vzc29yKSB7XHJcblx0XHR2YXIgb2JzdiA9IHZhbHVlQWNjZXNzb3IoKSxcclxuXHRcdFx0Y29uZmlnID0ga3YudXRpbHMuZ2V0Q29uZmlnT3B0aW9ucyhlbGVtZW50KSxcclxuXHRcdFx0dmFsID0gdW53cmFwKG9ic3YpLFxyXG5cdFx0XHRtc2cgPSBudWxsLFxyXG5cdFx0XHRpc01vZGlmaWVkID0gZmFsc2UsXHJcblx0XHRcdGlzVmFsaWQgPSBmYWxzZTtcclxuXHJcblx0XHRpZiAob2JzdiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JzdiA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB2YWxpZGF0aW9uRWxlbWVudCB0byB1bmRlZmluZWQgdmFsdWUuIGRhdGEtYmluZCBleHByZXNzaW9uOiAnICtcclxuXHRcdFx0XHRlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1iaW5kJykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlzTW9kaWZpZWQgPSBvYnN2LmlzTW9kaWZpZWQgJiYgb2Jzdi5pc01vZGlmaWVkKCk7XHJcblx0XHRpc1ZhbGlkID0gb2Jzdi5pc1ZhbGlkICYmIG9ic3YuaXNWYWxpZCgpO1xyXG5cclxuXHRcdC8vIGNyZWF0ZSBhbiBldmFsdWF0b3IgZnVuY3Rpb24gdGhhdCB3aWxsIHJldHVybiBzb21ldGhpbmcgbGlrZTpcclxuXHRcdC8vIGNzczogeyB2YWxpZGF0aW9uRWxlbWVudDogdHJ1ZSB9XHJcblx0XHR2YXIgY3NzU2V0dGluZ3NBY2Nlc3NvciA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGNzcyA9IHt9O1xyXG5cclxuXHRcdFx0dmFyIHNob3VsZFNob3cgPSAoKCFjb25maWcuZGVjb3JhdGVFbGVtZW50T25Nb2RpZmllZCB8fCBpc01vZGlmaWVkKSA/ICFpc1ZhbGlkIDogZmFsc2UpO1xyXG5cclxuXHRcdFx0Ly8gY3NzOiB7IHZhbGlkYXRpb25FbGVtZW50OiBmYWxzZSB9XHJcblx0XHRcdGNzc1tjb25maWcuZXJyb3JFbGVtZW50Q2xhc3NdID0gc2hvdWxkU2hvdztcclxuXHJcblx0XHRcdHJldHVybiBjc3M7XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vYWRkIG9yIHJlbW92ZSBjbGFzcyBvbiB0aGUgZWxlbWVudDtcclxuXHRcdGtvLmJpbmRpbmdIYW5kbGVycy5jc3MudXBkYXRlKGVsZW1lbnQsIGNzc1NldHRpbmdzQWNjZXNzb3IsIGFsbEJpbmRpbmdzQWNjZXNzb3IpO1xyXG5cdFx0aWYgKCFjb25maWcuZXJyb3JzQXNUaXRsZSkgeyByZXR1cm47IH1cclxuXHJcblx0XHRrby5iaW5kaW5nSGFuZGxlcnMuYXR0ci51cGRhdGUoZWxlbWVudCwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXJcclxuXHRcdFx0XHRoYXNNb2RpZmljYXRpb24gPSAhY29uZmlnLmVycm9yc0FzVGl0bGVPbk1vZGlmaWVkIHx8IGlzTW9kaWZpZWQsXHJcblx0XHRcdFx0dGl0bGUgPSBrdi51dGlscy5nZXRPcmlnaW5hbEVsZW1lbnRUaXRsZShlbGVtZW50KTtcclxuXHJcblx0XHRcdGlmIChoYXNNb2RpZmljYXRpb24gJiYgIWlzVmFsaWQpIHtcclxuXHRcdFx0XHRyZXR1cm4geyB0aXRsZTogb2Jzdi5lcnJvciwgJ2RhdGEtb3JpZy10aXRsZSc6IHRpdGxlIH07XHJcblx0XHRcdH0gZWxzZSBpZiAoIWhhc01vZGlmaWNhdGlvbiB8fCBpc1ZhbGlkKSB7XHJcblx0XHRcdFx0cmV0dXJuIHsgdGl0bGU6IHRpdGxlLCAnZGF0YS1vcmlnLXRpdGxlJzogbnVsbCB9O1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcbn07XHJcblxyXG4vLyBWYWxpZGF0aW9uT3B0aW9uczpcclxuLy8gVGhpcyBiaW5kaW5nIGhhbmRsZXIgYWxsb3dzIHlvdSB0byBvdmVycmlkZSB0aGUgaW5pdGlhbCBjb25maWcgYnkgc2V0dGluZyBhbnkgb2YgdGhlIG9wdGlvbnMgZm9yIGEgc3BlY2lmaWMgZWxlbWVudCBvciBjb250ZXh0IG9mIGVsZW1lbnRzXHJcbi8vXHJcbi8vIEV4YW1wbGU6XHJcbi8vIDxkaXYgZGF0YS1iaW5kPVwidmFsaWRhdGlvbk9wdGlvbnM6IHsgaW5zZXJ0TWVzc2FnZXM6IHRydWUsIG1lc3NhZ2VUZW1wbGF0ZTogJ2N1c3RvbVRlbXBsYXRlJywgZXJyb3JNZXNzYWdlQ2xhc3M6ICdteVNwZWNpYWxDbGFzcyd9XCI+XHJcbi8vICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgZGF0YS1iaW5kPVwidmFsdWU6IHNvbWVWYWx1ZVwiLz5cclxuLy8gICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBkYXRhLWJpbmQ9XCJ2YWx1ZTogc29tZVZhbHVlMlwiLz5cclxuLy8gPC9kaXY+XHJcbmtvLmJpbmRpbmdIYW5kbGVyc1sndmFsaWRhdGlvbk9wdGlvbnMnXSA9IChmdW5jdGlvbiAoKSB7XHJcblx0cmV0dXJuIHtcclxuXHRcdGluaXQ6IGZ1bmN0aW9uIChlbGVtZW50LCB2YWx1ZUFjY2Vzc29yLCBhbGxCaW5kaW5nc0FjY2Vzc29yLCB2aWV3TW9kZWwsIGJpbmRpbmdDb250ZXh0KSB7XHJcblx0XHRcdHZhciBvcHRpb25zID0gdW53cmFwKHZhbHVlQWNjZXNzb3IoKSk7XHJcblx0XHRcdGlmIChvcHRpb25zKSB7XHJcblx0XHRcdFx0dmFyIG5ld0NvbmZpZyA9IGV4dGVuZCh7fSwga3YuY29uZmlndXJhdGlvbik7XHJcblx0XHRcdFx0ZXh0ZW5kKG5ld0NvbmZpZywgb3B0aW9ucyk7XHJcblxyXG5cdFx0XHRcdC8vc3RvcmUgdGhlIHZhbGlkYXRpb24gb3B0aW9ucyBvbiB0aGUgbm9kZSBzbyB3ZSBjYW4gcmV0cmlldmUgaXQgbGF0ZXJcclxuXHRcdFx0XHRrdi51dGlscy5zZXREb21EYXRhKGVsZW1lbnQsIG5ld0NvbmZpZyk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9O1xyXG59KCkpO1xyXG47Ly8gVmFsaWRhdGlvbiBFeHRlbmRlcjpcclxuLy8gVGhpcyBpcyBmb3IgY3JlYXRpbmcgY3VzdG9tIHZhbGlkYXRpb24gbG9naWMgb24gdGhlIGZseVxyXG4vLyBFeGFtcGxlOlxyXG4vLyB2YXIgdGVzdCA9IGtvLm9ic2VydmFibGUoJ3NvbWV0aGluZycpLmV4dGVuZHsoXHJcbi8vICAgICAgdmFsaWRhdGlvbjoge1xyXG4vLyAgICAgICAgICB2YWxpZGF0b3I6IGZ1bmN0aW9uKHZhbCwgc29tZU90aGVyVmFsKXtcclxuLy8gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4vLyAgICAgICAgICB9LFxyXG4vLyAgICAgICAgICBtZXNzYWdlOiBcIlNvbWV0aGluZyBtdXN0IGJlIHJlYWxseSB3cm9uZyEnLFxyXG4vLyAgICAgICAgICBwYXJhbXM6IHRydWVcclxuLy8gICAgICB9XHJcbi8vICApfTtcclxua28uZXh0ZW5kZXJzWyd2YWxpZGF0aW9uJ10gPSBmdW5jdGlvbiAob2JzZXJ2YWJsZSwgcnVsZXMpIHsgLy8gYWxsb3cgc2luZ2xlIHJ1bGUgb3IgYXJyYXlcclxuXHRmb3JFYWNoKGt2LnV0aWxzLmlzQXJyYXkocnVsZXMpID8gcnVsZXMgOiBbcnVsZXNdLCBmdW5jdGlvbiAocnVsZSkge1xyXG5cdFx0Ly8gdGhlICdydWxlJyBiZWluZyBwYXNzZWQgaW4gaGVyZSBoYXMgbm8gbmFtZSB0byBpZGVudGlmeSBhIGNvcmUgUnVsZSxcclxuXHRcdC8vIHNvIHdlIGFkZCBpdCBhcyBhbiBhbm9ueW1vdXMgcnVsZVxyXG5cdFx0Ly8gSWYgdGhlIGRldmVsb3BlciBpcyB3YW50aW5nIHRvIHVzZSBhIGNvcmUgUnVsZSwgYnV0IHVzZSBhIGRpZmZlcmVudCBtZXNzYWdlIHNlZSB0aGUgJ2FkZEV4dGVuZGVyJyBsb2dpYyBmb3IgZXhhbXBsZXNcclxuXHRcdGt2LmFkZEFub255bW91c1J1bGUob2JzZXJ2YWJsZSwgcnVsZSk7XHJcblx0fSk7XHJcblx0cmV0dXJuIG9ic2VydmFibGU7XHJcbn07XHJcblxyXG4vL1RoaXMgaXMgdGhlIGV4dGVuZGVyIHRoYXQgbWFrZXMgYSBLbm9ja291dCBPYnNlcnZhYmxlIGFsc28gJ1ZhbGlkYXRhYmxlJ1xyXG4vL2V4YW1wbGVzIGluY2x1ZGU6XHJcbi8vIDEuIHZhciB0ZXN0ID0ga28ub2JzZXJ2YWJsZSgnc29tZXRoaW5nJykuZXh0ZW5kKHt2YWxpZGF0YWJsZTogdHJ1ZX0pO1xyXG4vLyB0aGlzIHdpbGwgZW5zdXJlIHRoYXQgdGhlIE9ic2VydmFibGUgb2JqZWN0IGlzIHNldHVwIHByb3Blcmx5IHRvIHJlc3BvbmQgdG8gcnVsZXNcclxuLy9cclxuLy8gMi4gdGVzdC5leHRlbmQoe3ZhbGlkYXRhYmxlOiBmYWxzZX0pO1xyXG4vLyB0aGlzIHdpbGwgcmVtb3ZlIHRoZSB2YWxpZGF0aW9uIHByb3BlcnRpZXMgZnJvbSB0aGUgT2JzZXJ2YWJsZSBvYmplY3Qgc2hvdWxkIHlvdSBuZWVkIHRvIGRvIHRoYXQuXHJcbmtvLmV4dGVuZGVyc1sndmFsaWRhdGFibGUnXSA9IGZ1bmN0aW9uIChvYnNlcnZhYmxlLCBvcHRpb25zKSB7XHJcblx0aWYgKCFrdi51dGlscy5pc09iamVjdChvcHRpb25zKSkge1xyXG5cdFx0b3B0aW9ucyA9IHsgZW5hYmxlOiBvcHRpb25zIH07XHJcblx0fVxyXG5cclxuXHRpZiAoISgnZW5hYmxlJyBpbiBvcHRpb25zKSkge1xyXG5cdFx0b3B0aW9ucy5lbmFibGUgPSB0cnVlO1xyXG5cdH1cclxuXHJcblx0aWYgKG9wdGlvbnMuZW5hYmxlICYmICFrdi51dGlscy5pc1ZhbGlkYXRhYmxlKG9ic2VydmFibGUpKSB7XHJcblx0XHR2YXIgY29uZmlnID0ga3YuY29uZmlndXJhdGlvbi52YWxpZGF0ZSB8fCB7fTtcclxuXHRcdHZhciB2YWxpZGF0aW9uT3B0aW9ucyA9IHtcclxuXHRcdFx0dGhyb3R0bGVFdmFsdWF0aW9uIDogb3B0aW9ucy50aHJvdHRsZSB8fCBjb25maWcudGhyb3R0bGVcclxuXHRcdH07XHJcblxyXG5cdFx0b2JzZXJ2YWJsZS5lcnJvciA9IGtvLm9ic2VydmFibGUobnVsbCk7IC8vIGhvbGRzIHRoZSBlcnJvciBtZXNzYWdlLCB3ZSBvbmx5IG5lZWQgb25lIHNpbmNlIHdlIHN0b3AgcHJvY2Vzc2luZyB2YWxpZGF0b3JzIHdoZW4gb25lIGlzIGludmFsaWRcclxuXHJcblx0XHQvLyBvYnNlcnZhYmxlLnJ1bGVzOlxyXG5cdFx0Ly8gT2JzZXJ2YWJsZUFycmF5IG9mIFJ1bGUgQ29udGV4dHMsIHdoZXJlIGEgUnVsZSBDb250ZXh0IGlzIHNpbXBseSB0aGUgbmFtZSBvZiBhIHJ1bGUgYW5kIHRoZSBwYXJhbXMgdG8gc3VwcGx5IHRvIGl0XHJcblx0XHQvL1xyXG5cdFx0Ly8gUnVsZSBDb250ZXh0ID0geyBydWxlOiAnPHJ1bGUgbmFtZT4nLCBwYXJhbXM6ICc8cGFzc2VkIGluIHBhcmFtcz4nLCBtZXNzYWdlOiAnPE92ZXJyaWRlIG9mIGRlZmF1bHQgTWVzc2FnZT4nIH1cclxuXHRcdG9ic2VydmFibGUucnVsZXMgPSBrby5vYnNlcnZhYmxlQXJyYXkoKTsgLy9ob2xkcyB0aGUgcnVsZSBDb250ZXh0cyB0byB1c2UgYXMgcGFydCBvZiB2YWxpZGF0aW9uXHJcblxyXG5cdFx0Ly9pbiBjYXNlIGFzeW5jIHZhbGlkYXRpb24gaXMgb2NjdXJyaW5nXHJcblx0XHRvYnNlcnZhYmxlLmlzVmFsaWRhdGluZyA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xyXG5cclxuXHRcdC8vdGhlIHRydWUgaG9sZGVyIG9mIHdoZXRoZXIgdGhlIG9ic2VydmFibGUgaXMgdmFsaWQgb3Igbm90XHJcblx0XHRvYnNlcnZhYmxlLl9fdmFsaWRfXyA9IGtvLm9ic2VydmFibGUodHJ1ZSk7XHJcblxyXG5cdFx0b2JzZXJ2YWJsZS5pc01vZGlmaWVkID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XHJcblxyXG5cdFx0Ly8gYSBzZW1pLXByb3RlY3RlZCBvYnNlcnZhYmxlXHJcblx0XHRvYnNlcnZhYmxlLmlzVmFsaWQgPSBrby5jb21wdXRlZChvYnNlcnZhYmxlLl9fdmFsaWRfXyk7XHJcblxyXG5cdFx0Ly9tYW51YWxseSBzZXQgZXJyb3Igc3RhdGVcclxuXHRcdG9ic2VydmFibGUuc2V0RXJyb3IgPSBmdW5jdGlvbiAoZXJyb3IpIHtcclxuXHRcdFx0dmFyIHByZXZpb3VzRXJyb3IgPSBvYnNlcnZhYmxlLmVycm9yLnBlZWsoKTtcclxuXHRcdFx0dmFyIHByZXZpb3VzSXNWYWxpZCA9IG9ic2VydmFibGUuX192YWxpZF9fLnBlZWsoKTtcclxuXHJcblx0XHRcdG9ic2VydmFibGUuZXJyb3IoZXJyb3IpO1xyXG5cdFx0XHRvYnNlcnZhYmxlLl9fdmFsaWRfXyhmYWxzZSk7XHJcblxyXG5cdFx0XHRpZiAocHJldmlvdXNFcnJvciAhPT0gZXJyb3IgJiYgIXByZXZpb3VzSXNWYWxpZCkge1xyXG5cdFx0XHRcdC8vIGlmIHRoZSBvYnNlcnZhYmxlIHdhcyBub3QgdmFsaWQgYmVmb3JlIHRoZW4gaXNWYWxpZCB3aWxsIG5vdCBtdXRhdGUsXHJcblx0XHRcdFx0Ly8gaGVuY2UgY2F1c2luZyBhbnkgZ3JvdXBpbmcgdG8gbm90IGRpc3BsYXkgdGhlIGxhdGVzdCBlcnJvci5cclxuXHRcdFx0XHRvYnNlcnZhYmxlLmlzVmFsaWQubm90aWZ5U3Vic2NyaWJlcnMoKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0XHQvL21hbnVhbGx5IGNsZWFyIGVycm9yIHN0YXRlXHJcblx0XHRvYnNlcnZhYmxlLmNsZWFyRXJyb3IgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdG9ic2VydmFibGUuZXJyb3IobnVsbCk7XHJcblx0XHRcdG9ic2VydmFibGUuX192YWxpZF9fKHRydWUpO1xyXG5cdFx0XHRyZXR1cm4gb2JzZXJ2YWJsZTtcclxuXHRcdH07XHJcblxyXG5cdFx0Ly9zdWJzY3JpYmUgdG8gY2hhbmdlcyBpbiB0aGUgb2JzZXJ2YWJsZVxyXG5cdFx0dmFyIGhfY2hhbmdlID0gb2JzZXJ2YWJsZS5zdWJzY3JpYmUoZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRvYnNlcnZhYmxlLmlzTW9kaWZpZWQodHJ1ZSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyB3ZSB1c2UgYSBjb21wdXRlZCBoZXJlIHRvIGVuc3VyZSB0aGF0IGFueXRpbWUgYSBkZXBlbmRlbmN5IGNoYW5nZXMsIHRoZVxyXG5cdFx0Ly8gdmFsaWRhdGlvbiBsb2dpYyBldmFsdWF0ZXNcclxuXHRcdHZhciBoX29ic1ZhbGlkYXRpb25UcmlnZ2VyID0ga28uY29tcHV0ZWQoZXh0ZW5kKHtcclxuXHRcdFx0cmVhZDogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHZhciBvYnMgPSBvYnNlcnZhYmxlKCksXHJcblx0XHRcdFx0XHRydWxlQ29udGV4dHMgPSBvYnNlcnZhYmxlLnJ1bGVzKCk7XHJcblxyXG5cdFx0XHRcdGt2LnZhbGlkYXRlT2JzZXJ2YWJsZShvYnNlcnZhYmxlKTtcclxuXHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH0sIHZhbGlkYXRpb25PcHRpb25zKSk7XHJcblxyXG5cdFx0ZXh0ZW5kKGhfb2JzVmFsaWRhdGlvblRyaWdnZXIsIHZhbGlkYXRpb25PcHRpb25zKTtcclxuXHJcblx0XHRvYnNlcnZhYmxlLl9kaXNwb3NlVmFsaWRhdGlvbiA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly9maXJzdCBkaXNwb3NlIG9mIHRoZSBzdWJzY3JpcHRpb25zXHJcblx0XHRcdG9ic2VydmFibGUuaXNWYWxpZC5kaXNwb3NlKCk7XHJcblx0XHRcdG9ic2VydmFibGUucnVsZXMucmVtb3ZlQWxsKCk7XHJcblx0XHRcdGhfY2hhbmdlLmRpc3Bvc2UoKTtcclxuXHRcdFx0aF9vYnNWYWxpZGF0aW9uVHJpZ2dlci5kaXNwb3NlKCk7XHJcblxyXG5cdFx0XHRkZWxldGUgb2JzZXJ2YWJsZVsncnVsZXMnXTtcclxuXHRcdFx0ZGVsZXRlIG9ic2VydmFibGVbJ2Vycm9yJ107XHJcblx0XHRcdGRlbGV0ZSBvYnNlcnZhYmxlWydpc1ZhbGlkJ107XHJcblx0XHRcdGRlbGV0ZSBvYnNlcnZhYmxlWydpc1ZhbGlkYXRpbmcnXTtcclxuXHRcdFx0ZGVsZXRlIG9ic2VydmFibGVbJ19fdmFsaWRfXyddO1xyXG5cdFx0XHRkZWxldGUgb2JzZXJ2YWJsZVsnaXNNb2RpZmllZCddO1xyXG4gICAgICAgICAgICBkZWxldGUgb2JzZXJ2YWJsZVsnc2V0RXJyb3InXTtcclxuICAgICAgICAgICAgZGVsZXRlIG9ic2VydmFibGVbJ2NsZWFyRXJyb3InXTtcclxuICAgICAgICAgICAgZGVsZXRlIG9ic2VydmFibGVbJ19kaXNwb3NlVmFsaWRhdGlvbiddO1xyXG5cdFx0fTtcclxuXHR9IGVsc2UgaWYgKG9wdGlvbnMuZW5hYmxlID09PSBmYWxzZSAmJiBvYnNlcnZhYmxlLl9kaXNwb3NlVmFsaWRhdGlvbikge1xyXG5cdFx0b2JzZXJ2YWJsZS5fZGlzcG9zZVZhbGlkYXRpb24oKTtcclxuXHR9XHJcblx0cmV0dXJuIG9ic2VydmFibGU7XHJcbn07XHJcblxyXG5mdW5jdGlvbiB2YWxpZGF0ZVN5bmMob2JzZXJ2YWJsZSwgcnVsZSwgY3R4KSB7XHJcblx0Ly9FeGVjdXRlIHRoZSB2YWxpZGF0b3IgYW5kIHNlZSBpZiBpdHMgdmFsaWRcclxuXHRpZiAoIXJ1bGUudmFsaWRhdG9yKG9ic2VydmFibGUoKSwgKGN0eC5wYXJhbXMgPT09IHVuZGVmaW5lZCA/IHRydWUgOiB1bndyYXAoY3R4LnBhcmFtcykpKSkgeyAvLyBkZWZhdWx0IHBhcmFtIGlzIHRydWUsIGVnLiByZXF1aXJlZCA9IHRydWVcclxuXHJcblx0XHQvL25vdCB2YWxpZCwgc28gZm9ybWF0IHRoZSBlcnJvciBtZXNzYWdlIGFuZCBzdGljayBpdCBpbiB0aGUgJ2Vycm9yJyB2YXJpYWJsZVxyXG5cdFx0b2JzZXJ2YWJsZS5zZXRFcnJvcihrdi5mb3JtYXRNZXNzYWdlKFxyXG5cdFx0XHRcdFx0Y3R4Lm1lc3NhZ2UgfHwgcnVsZS5tZXNzYWdlLFxyXG5cdFx0XHRcdFx0dW53cmFwKGN0eC5wYXJhbXMpLFxyXG5cdFx0XHRcdFx0b2JzZXJ2YWJsZSkpO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHZhbGlkYXRlQXN5bmMob2JzZXJ2YWJsZSwgcnVsZSwgY3R4KSB7XHJcblx0b2JzZXJ2YWJsZS5pc1ZhbGlkYXRpbmcodHJ1ZSk7XHJcblxyXG5cdHZhciBjYWxsQmFjayA9IGZ1bmN0aW9uICh2YWxPYmopIHtcclxuXHRcdHZhciBpc1ZhbGlkID0gZmFsc2UsXHJcblx0XHRcdG1zZyA9ICcnO1xyXG5cclxuXHRcdGlmICghb2JzZXJ2YWJsZS5fX3ZhbGlkX18oKSkge1xyXG5cclxuXHRcdFx0Ly8gc2luY2Ugd2UncmUgcmV0dXJuaW5nIGVhcmx5LCBtYWtlIHN1cmUgd2UgdHVybiB0aGlzIG9mZlxyXG5cdFx0XHRvYnNlcnZhYmxlLmlzVmFsaWRhdGluZyhmYWxzZSk7XHJcblxyXG5cdFx0XHRyZXR1cm47IC8vaWYgaXRzIGFscmVhZHkgTk9UIHZhbGlkLCBkb24ndCBhZGQgdG8gdGhhdFxyXG5cdFx0fVxyXG5cclxuXHRcdC8vd2Ugd2VyZSBoYW5kZWQgYmFjayBhIGNvbXBsZXggb2JqZWN0XHJcblx0XHRpZiAodmFsT2JqWydtZXNzYWdlJ10pIHtcclxuXHRcdFx0aXNWYWxpZCA9IHZhbE9iai5pc1ZhbGlkO1xyXG5cdFx0XHRtc2cgPSB2YWxPYmoubWVzc2FnZTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlzVmFsaWQgPSB2YWxPYmo7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCFpc1ZhbGlkKSB7XHJcblx0XHRcdC8vbm90IHZhbGlkLCBzbyBmb3JtYXQgdGhlIGVycm9yIG1lc3NhZ2UgYW5kIHN0aWNrIGl0IGluIHRoZSAnZXJyb3InIHZhcmlhYmxlXHJcblx0XHRcdG9ic2VydmFibGUuZXJyb3Ioa3YuZm9ybWF0TWVzc2FnZShcclxuXHRcdFx0XHRtc2cgfHwgY3R4Lm1lc3NhZ2UgfHwgcnVsZS5tZXNzYWdlLFxyXG5cdFx0XHRcdHVud3JhcChjdHgucGFyYW1zKSxcclxuXHRcdFx0XHRvYnNlcnZhYmxlKSk7XHJcblx0XHRcdG9ic2VydmFibGUuX192YWxpZF9fKGlzVmFsaWQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHRlbGwgaXQgdGhhdCB3ZSdyZSBkb25lXHJcblx0XHRvYnNlcnZhYmxlLmlzVmFsaWRhdGluZyhmYWxzZSk7XHJcblx0fTtcclxuXHJcblx0a3YudXRpbHMuYXN5bmMoZnVuY3Rpb24oKSB7XHJcblx0ICAgIC8vZmlyZSB0aGUgdmFsaWRhdG9yIGFuZCBoYW5kIGl0IHRoZSBjYWxsYmFja1xyXG4gICAgICAgIHJ1bGUudmFsaWRhdG9yKG9ic2VydmFibGUoKSwgY3R4LnBhcmFtcyA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHVud3JhcChjdHgucGFyYW1zKSwgY2FsbEJhY2spO1xyXG5cdH0pO1xyXG59XHJcblxyXG5rdi52YWxpZGF0ZU9ic2VydmFibGUgPSBmdW5jdGlvbiAob2JzZXJ2YWJsZSkge1xyXG5cdHZhciBpID0gMCxcclxuXHRcdHJ1bGUsIC8vIHRoZSBydWxlIHZhbGlkYXRvciB0byBleGVjdXRlXHJcblx0XHRjdHgsIC8vIHRoZSBjdXJyZW50IFJ1bGUgQ29udGV4dCBmb3IgdGhlIGxvb3BcclxuXHRcdHJ1bGVDb250ZXh0cyA9IG9ic2VydmFibGUucnVsZXMoKSwgLy9jYWNoZSBmb3IgaXRlcmF0b3JcclxuXHRcdGxlbiA9IHJ1bGVDb250ZXh0cy5sZW5ndGg7IC8vY2FjaGUgZm9yIGl0ZXJhdG9yXHJcblxyXG5cdGZvciAoOyBpIDwgbGVuOyBpKyspIHtcclxuXHJcblx0XHQvL2dldCB0aGUgUnVsZSBDb250ZXh0IGluZm8gdG8gZ2l2ZSB0byB0aGUgY29yZSBSdWxlXHJcblx0XHRjdHggPSBydWxlQ29udGV4dHNbaV07XHJcblxyXG5cdFx0Ly8gY2hlY2tzIGFuICdvbmx5SWYnIGNvbmRpdGlvblxyXG5cdFx0aWYgKGN0eC5jb25kaXRpb24gJiYgIWN0eC5jb25kaXRpb24oKSkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvL2dldCB0aGUgY29yZSBSdWxlIHRvIHVzZSBmb3IgdmFsaWRhdGlvblxyXG5cdFx0cnVsZSA9IGN0eC5ydWxlID8ga3YucnVsZXNbY3R4LnJ1bGVdIDogY3R4O1xyXG5cclxuXHRcdGlmIChydWxlWydhc3luYyddIHx8IGN0eFsnYXN5bmMnXSkge1xyXG5cdFx0XHQvL3J1biBhc3luYyB2YWxpZGF0aW9uXHJcblx0XHRcdHZhbGlkYXRlQXN5bmMob2JzZXJ2YWJsZSwgcnVsZSwgY3R4KTtcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvL3J1biBub3JtYWwgc3luYyB2YWxpZGF0aW9uXHJcblx0XHRcdGlmICghdmFsaWRhdGVTeW5jKG9ic2VydmFibGUsIHJ1bGUsIGN0eCkpIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vYnJlYWsgb3V0IG9mIHRoZSBsb29wXHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0Ly9maW5hbGx5IGlmIHdlIGdvdCB0aGlzIGZhciwgbWFrZSB0aGUgb2JzZXJ2YWJsZSB2YWxpZCBhZ2FpbiFcclxuXHRvYnNlcnZhYmxlLmNsZWFyRXJyb3IoKTtcclxuXHRyZXR1cm4gdHJ1ZTtcclxufTtcclxuO1xyXG52YXIgX2xvY2FsZXMgPSB7fTtcclxudmFyIF9jdXJyZW50TG9jYWxlO1xyXG5cclxua3YuZGVmaW5lTG9jYWxlID0gZnVuY3Rpb24obmFtZSwgdmFsdWVzKSB7XHJcblx0aWYgKG5hbWUgJiYgdmFsdWVzKSB7XHJcblx0XHRfbG9jYWxlc1tuYW1lLnRvTG93ZXJDYXNlKCldID0gdmFsdWVzO1xyXG5cdFx0cmV0dXJuIHZhbHVlcztcclxuXHR9XHJcblx0cmV0dXJuIG51bGw7XHJcbn07XHJcblxyXG5rdi5sb2NhbGUgPSBmdW5jdGlvbihuYW1lKSB7XHJcblx0aWYgKG5hbWUpIHtcclxuXHRcdG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdFx0aWYgKF9sb2NhbGVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XHJcblx0XHRcdGt2LmxvY2FsaXplKF9sb2NhbGVzW25hbWVdKTtcclxuXHRcdFx0X2N1cnJlbnRMb2NhbGUgPSBuYW1lO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTG9jYWxpemF0aW9uICcgKyBuYW1lICsgJyBoYXMgbm90IGJlZW4gbG9hZGVkLicpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gX2N1cnJlbnRMb2NhbGU7XHJcbn07XHJcblxyXG4vL3F1aWNrIGZ1bmN0aW9uIHRvIG92ZXJyaWRlIHJ1bGUgbWVzc2FnZXNcclxua3YubG9jYWxpemUgPSBmdW5jdGlvbiAobXNnVHJhbnNsYXRpb25zKSB7XHJcblx0dmFyIHJ1bGVzID0ga3YucnVsZXM7XHJcblxyXG5cdC8vbG9vcCB0aGUgcHJvcGVydGllcyBpbiB0aGUgb2JqZWN0IGFuZCBhc3NpZ24gdGhlIG1zZyB0byB0aGUgcnVsZVxyXG5cdGZvciAodmFyIHJ1bGVOYW1lIGluIG1zZ1RyYW5zbGF0aW9ucykge1xyXG5cdFx0aWYgKHJ1bGVzLmhhc093blByb3BlcnR5KHJ1bGVOYW1lKSkge1xyXG5cdFx0XHRydWxlc1tydWxlTmFtZV0ubWVzc2FnZSA9IG1zZ1RyYW5zbGF0aW9uc1tydWxlTmFtZV07XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuLy8gUG9wdWxhdGUgZGVmYXVsdCBsb2NhbGUgKHRoaXMgd2lsbCBtYWtlIGVuLVVTLmpzIHNvbWV3aGF0IHJlZHVuZGFudClcclxuKGZ1bmN0aW9uKCkge1xyXG5cdHZhciBsb2NhbGVEYXRhID0ge307XHJcblx0dmFyIHJ1bGVzID0ga3YucnVsZXM7XHJcblxyXG5cdGZvciAodmFyIHJ1bGVOYW1lIGluIHJ1bGVzKSB7XHJcblx0XHRpZiAocnVsZXMuaGFzT3duUHJvcGVydHkocnVsZU5hbWUpKSB7XHJcblx0XHRcdGxvY2FsZURhdGFbcnVsZU5hbWVdID0gcnVsZXNbcnVsZU5hbWVdLm1lc3NhZ2U7XHJcblx0XHR9XHJcblx0fVxyXG5cdGt2LmRlZmluZUxvY2FsZSgnZW4tdXMnLCBsb2NhbGVEYXRhKTtcclxufSkoKTtcclxuXHJcbi8vIE5vIG5lZWQgdG8gaW52b2tlIGxvY2FsZSBiZWNhdXNlIHRoZSBtZXNzYWdlcyBhcmUgYWxyZWFkeSBkZWZpbmVkIGFsb25nIHdpdGggdGhlIHJ1bGVzIGZvciBlbi1VU1xyXG5fY3VycmVudExvY2FsZSA9ICdlbi11cyc7XHJcbjsvKipcclxuICogUG9zc2libGUgaW52b2NhdGlvbnM6XHJcbiAqIFx0XHRhcHBseUJpbmRpbmdzV2l0aFZhbGlkYXRpb24odmlld01vZGVsKVxyXG4gKiBcdFx0YXBwbHlCaW5kaW5nc1dpdGhWYWxpZGF0aW9uKHZpZXdNb2RlbCwgb3B0aW9ucylcclxuICogXHRcdGFwcGx5QmluZGluZ3NXaXRoVmFsaWRhdGlvbih2aWV3TW9kZWwsIHJvb3ROb2RlKVxyXG4gKlx0XHRhcHBseUJpbmRpbmdzV2l0aFZhbGlkYXRpb24odmlld01vZGVsLCByb290Tm9kZSwgb3B0aW9ucylcclxuICovXHJcbmtvLmFwcGx5QmluZGluZ3NXaXRoVmFsaWRhdGlvbiA9IGZ1bmN0aW9uICh2aWV3TW9kZWwsIHJvb3ROb2RlLCBvcHRpb25zKSB7XHJcblx0dmFyIG5vZGUgPSBkb2N1bWVudC5ib2R5LFxyXG5cdFx0Y29uZmlnO1xyXG5cclxuXHRpZiAocm9vdE5vZGUgJiYgcm9vdE5vZGUubm9kZVR5cGUpIHtcclxuXHRcdG5vZGUgPSByb290Tm9kZTtcclxuXHRcdGNvbmZpZyA9IG9wdGlvbnM7XHJcblx0fVxyXG5cdGVsc2Uge1xyXG5cdFx0Y29uZmlnID0gcm9vdE5vZGU7XHJcblx0fVxyXG5cclxuXHRrdi5pbml0KCk7XHJcblxyXG5cdGlmIChjb25maWcpIHtcclxuXHRcdGNvbmZpZyA9IGV4dGVuZChleHRlbmQoe30sIGt2LmNvbmZpZ3VyYXRpb24pLCBjb25maWcpO1xyXG5cdFx0a3YudXRpbHMuc2V0RG9tRGF0YShub2RlLCBjb25maWcpO1xyXG5cdH1cclxuXHJcblx0a28uYXBwbHlCaW5kaW5ncyh2aWV3TW9kZWwsIG5vZGUpO1xyXG59O1xyXG5cclxuLy9vdmVycmlkZSB0aGUgb3JpZ2luYWwgYXBwbHlCaW5kaW5ncyBzbyB0aGF0IHdlIGNhbiBlbnN1cmUgYWxsIG5ldyBydWxlcyBhbmQgd2hhdCBub3QgYXJlIGNvcnJlY3RseSByZWdpc3RlcmVkXHJcbnZhciBvcmlnQXBwbHlCaW5kaW5ncyA9IGtvLmFwcGx5QmluZGluZ3M7XHJcbmtvLmFwcGx5QmluZGluZ3MgPSBmdW5jdGlvbiAoKSB7XHJcblx0a3YuaW5pdCgpO1xyXG5cdG9yaWdBcHBseUJpbmRpbmdzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn07XHJcblxyXG5rby52YWxpZGF0ZWRPYnNlcnZhYmxlID0gZnVuY3Rpb24gKGluaXRpYWxWYWx1ZSwgb3B0aW9ucykge1xyXG5cdGlmICghb3B0aW9ucyAmJiAha3YudXRpbHMuaXNPYmplY3QoaW5pdGlhbFZhbHVlKSkge1xyXG5cdFx0cmV0dXJuIGtvLm9ic2VydmFibGUoaW5pdGlhbFZhbHVlKS5leHRlbmQoeyB2YWxpZGF0YWJsZTogdHJ1ZSB9KTtcclxuXHR9XHJcblxyXG5cdHZhciBvYnN2ID0ga28ub2JzZXJ2YWJsZShpbml0aWFsVmFsdWUpO1xyXG5cdG9ic3YuZXJyb3JzID0ga3YuZ3JvdXAoa3YudXRpbHMuaXNPYmplY3QoaW5pdGlhbFZhbHVlKSA/IGluaXRpYWxWYWx1ZSA6IHt9LCBvcHRpb25zKTtcclxuXHRvYnN2LmlzVmFsaWQgPSBrby5vYnNlcnZhYmxlKG9ic3YuZXJyb3JzKCkubGVuZ3RoID09PSAwKTtcclxuXHJcblx0aWYgKGtvLmlzT2JzZXJ2YWJsZShvYnN2LmVycm9ycykpIHtcclxuXHRcdG9ic3YuZXJyb3JzLnN1YnNjcmliZShmdW5jdGlvbihlcnJvcnMpIHtcclxuXHRcdFx0b2Jzdi5pc1ZhbGlkKGVycm9ycy5sZW5ndGggPT09IDApO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdGVsc2Uge1xyXG5cdFx0a28uY29tcHV0ZWQob2Jzdi5lcnJvcnMpLnN1YnNjcmliZShmdW5jdGlvbiAoZXJyb3JzKSB7XHJcblx0XHRcdG9ic3YuaXNWYWxpZChlcnJvcnMubGVuZ3RoID09PSAwKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0b2Jzdi5zdWJzY3JpYmUoZnVuY3Rpb24obmV3VmFsdWUpIHtcclxuXHRcdGlmICgha3YudXRpbHMuaXNPYmplY3QobmV3VmFsdWUpKSB7XHJcblx0XHRcdC8qXHJcblx0XHRcdCAqIFRoZSB2YWxpZGF0aW9uIGdyb3VwIHdvcmtzIG9uIG9iamVjdHMuXHJcblx0XHRcdCAqIFNpbmNlIHRoZSBuZXcgdmFsdWUgaXMgYSBwcmltaXRpdmUgKHNjYWxhciwgbnVsbCBvciB1bmRlZmluZWQpIHdlIG5lZWRcclxuXHRcdFx0ICogdG8gY3JlYXRlIGFuIGVtcHR5IG9iamVjdCB0byBwYXNzIGFsb25nLlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0bmV3VmFsdWUgPSB7fTtcclxuXHRcdH1cclxuXHRcdC8vIEZvcmNlIHRoZSBncm91cCB0byByZWZyZXNoXHJcblx0XHRvYnN2LmVycm9ycy5fdXBkYXRlU3RhdGUobmV3VmFsdWUpO1xyXG5cdFx0b2Jzdi5pc1ZhbGlkKG9ic3YuZXJyb3JzKCkubGVuZ3RoID09PSAwKTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIG9ic3Y7XHJcbn07XHJcbjt9KSk7IiwiLyohXG4gKiBLbm9ja291dCBKYXZhU2NyaXB0IGxpYnJhcnkgdjMuNS4xXG4gKiAoYykgVGhlIEtub2Nrb3V0LmpzIHRlYW0gLSBodHRwOi8va25vY2tvdXRqcy5jb20vXG4gKiBMaWNlbnNlOiBNSVQgKGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwKVxuICovXG5cbihmdW5jdGlvbigpIHsoZnVuY3Rpb24obil7dmFyIEE9dGhpc3x8KDAsZXZhbCkoXCJ0aGlzXCIpLHc9QS5kb2N1bWVudCxSPUEubmF2aWdhdG9yLHY9QS5qUXVlcnksSD1BLkpTT047dnx8XCJ1bmRlZmluZWRcIj09PXR5cGVvZiBqUXVlcnl8fCh2PWpRdWVyeSk7KGZ1bmN0aW9uKG4pe1wiZnVuY3Rpb25cIj09PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQ/ZGVmaW5lKFtcImV4cG9ydHNcIixcInJlcXVpcmVcIl0sbik6XCJvYmplY3RcIj09PXR5cGVvZiBleHBvcnRzJiZcIm9iamVjdFwiPT09dHlwZW9mIG1vZHVsZT9uKG1vZHVsZS5leHBvcnRzfHxleHBvcnRzKTpuKEEua289e30pfSkoZnVuY3Rpb24oUyxUKXtmdW5jdGlvbiBLKGEsYyl7cmV0dXJuIG51bGw9PT1hfHx0eXBlb2YgYSBpbiBXP2E9PT1jOiExfWZ1bmN0aW9uIFgoYixjKXt2YXIgZDtyZXR1cm4gZnVuY3Rpb24oKXtkfHwoZD1hLmEuc2V0VGltZW91dChmdW5jdGlvbigpe2Q9bjtiKCl9LGMpKX19ZnVuY3Rpb24gWShiLGMpe3ZhciBkO3JldHVybiBmdW5jdGlvbigpe2NsZWFyVGltZW91dChkKTtcbmQ9YS5hLnNldFRpbWVvdXQoYixjKX19ZnVuY3Rpb24gWihhLGMpe2MmJlwiY2hhbmdlXCIhPT1jP1wiYmVmb3JlQ2hhbmdlXCI9PT1jP3RoaXMucGMoYSk6dGhpcy5nYihhLGMpOnRoaXMucWMoYSl9ZnVuY3Rpb24gYWEoYSxjKXtudWxsIT09YyYmYy5zJiZjLnMoKX1mdW5jdGlvbiBiYShhLGMpe3ZhciBkPXRoaXMucWQsZT1kW3JdO2UucmF8fCh0aGlzLlFiJiZ0aGlzLm1iW2NdPyhkLnVjKGMsYSx0aGlzLm1iW2NdKSx0aGlzLm1iW2NdPW51bGwsLS10aGlzLlFiKTplLklbY118fGQudWMoYyxhLGUuSj97ZGE6YX06ZC4kYyhhKSksYS5KYSYmYS5nZCgpKX12YXIgYT1cInVuZGVmaW5lZFwiIT09dHlwZW9mIFM/Uzp7fTthLmI9ZnVuY3Rpb24oYixjKXtmb3IodmFyIGQ9Yi5zcGxpdChcIi5cIiksZT1hLGY9MDtmPGQubGVuZ3RoLTE7ZisrKWU9ZVtkW2ZdXTtlW2RbZC5sZW5ndGgtMV1dPWN9O2EuTD1mdW5jdGlvbihhLGMsZCl7YVtjXT1kfTthLnZlcnNpb249XCIzLjUuMVwiO2EuYihcInZlcnNpb25cIixcbmEudmVyc2lvbik7YS5vcHRpb25zPXtkZWZlclVwZGF0ZXM6ITEsdXNlT25seU5hdGl2ZUV2ZW50czohMSxmb3JlYWNoSGlkZXNEZXN0cm95ZWQ6ITF9O2EuYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGIoYSxiKXtmb3IodmFyIGMgaW4gYSlmLmNhbGwoYSxjKSYmYihjLGFbY10pfWZ1bmN0aW9uIGMoYSxiKXtpZihiKWZvcih2YXIgYyBpbiBiKWYuY2FsbChiLGMpJiYoYVtjXT1iW2NdKTtyZXR1cm4gYX1mdW5jdGlvbiBkKGEsYil7YS5fX3Byb3RvX189YjtyZXR1cm4gYX1mdW5jdGlvbiBlKGIsYyxkLGUpe3ZhciBsPWJbY10ubWF0Y2gocSl8fFtdO2EuYS5EKGQubWF0Y2gocSksZnVuY3Rpb24oYil7YS5hLk5hKGwsYixlKX0pO2JbY109bC5qb2luKFwiIFwiKX12YXIgZj1PYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LGc9e19fcHJvdG9fXzpbXX1pbnN0YW5jZW9mIEFycmF5LGg9XCJmdW5jdGlvblwiPT09dHlwZW9mIFN5bWJvbCxtPXt9LGs9e307bVtSJiYvRmlyZWZveFxcLzIvaS50ZXN0KFIudXNlckFnZW50KT9cblwiS2V5Ym9hcmRFdmVudFwiOlwiVUlFdmVudHNcIl09W1wia2V5dXBcIixcImtleWRvd25cIixcImtleXByZXNzXCJdO20uTW91c2VFdmVudHM9XCJjbGljayBkYmxjbGljayBtb3VzZWRvd24gbW91c2V1cCBtb3VzZW1vdmUgbW91c2VvdmVyIG1vdXNlb3V0IG1vdXNlZW50ZXIgbW91c2VsZWF2ZVwiLnNwbGl0KFwiIFwiKTtiKG0sZnVuY3Rpb24oYSxiKXtpZihiLmxlbmd0aClmb3IodmFyIGM9MCxkPWIubGVuZ3RoO2M8ZDtjKyspa1tiW2NdXT1hfSk7dmFyIGw9e3Byb3BlcnR5Y2hhbmdlOiEwfSxwPXcmJmZ1bmN0aW9uKCl7Zm9yKHZhciBhPTMsYj13LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksYz1iLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaVwiKTtiLmlubmVySFRNTD1cIlxceDNjIS0tW2lmIGd0IElFIFwiKyArK2ErXCJdPjxpPjwvaT48IVtlbmRpZl0tLVxceDNlXCIsY1swXTspO3JldHVybiA0PGE/YTpufSgpLHE9L1xcUysvZyx0O3JldHVybntKYzpbXCJhdXRoZW50aWNpdHlfdG9rZW5cIiwvXl9fUmVxdWVzdFZlcmlmaWNhdGlvblRva2VuKF8uKik/JC9dLFxuRDpmdW5jdGlvbihhLGIsYyl7Zm9yKHZhciBkPTAsZT1hLmxlbmd0aDtkPGU7ZCsrKWIuY2FsbChjLGFbZF0sZCxhKX0sQTpcImZ1bmN0aW9uXCI9PXR5cGVvZiBBcnJheS5wcm90b3R5cGUuaW5kZXhPZj9mdW5jdGlvbihhLGIpe3JldHVybiBBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKGEsYil9OmZ1bmN0aW9uKGEsYil7Zm9yKHZhciBjPTAsZD1hLmxlbmd0aDtjPGQ7YysrKWlmKGFbY109PT1iKXJldHVybiBjO3JldHVybi0xfSxMYjpmdW5jdGlvbihhLGIsYyl7Zm9yKHZhciBkPTAsZT1hLmxlbmd0aDtkPGU7ZCsrKWlmKGIuY2FsbChjLGFbZF0sZCxhKSlyZXR1cm4gYVtkXTtyZXR1cm4gbn0sUGE6ZnVuY3Rpb24oYixjKXt2YXIgZD1hLmEuQShiLGMpOzA8ZD9iLnNwbGljZShkLDEpOjA9PT1kJiZiLnNoaWZ0KCl9LHdjOmZ1bmN0aW9uKGIpe3ZhciBjPVtdO2ImJmEuYS5EKGIsZnVuY3Rpb24oYil7MD5hLmEuQShjLGIpJiZjLnB1c2goYil9KTtyZXR1cm4gY30sTWI6ZnVuY3Rpb24oYSxcbmIsYyl7dmFyIGQ9W107aWYoYSlmb3IodmFyIGU9MCxsPWEubGVuZ3RoO2U8bDtlKyspZC5wdXNoKGIuY2FsbChjLGFbZV0sZSkpO3JldHVybiBkfSxqYjpmdW5jdGlvbihhLGIsYyl7dmFyIGQ9W107aWYoYSlmb3IodmFyIGU9MCxsPWEubGVuZ3RoO2U8bDtlKyspYi5jYWxsKGMsYVtlXSxlKSYmZC5wdXNoKGFbZV0pO3JldHVybiBkfSxOYjpmdW5jdGlvbihhLGIpe2lmKGIgaW5zdGFuY2VvZiBBcnJheSlhLnB1c2guYXBwbHkoYSxiKTtlbHNlIGZvcih2YXIgYz0wLGQ9Yi5sZW5ndGg7YzxkO2MrKylhLnB1c2goYltjXSk7cmV0dXJuIGF9LE5hOmZ1bmN0aW9uKGIsYyxkKXt2YXIgZT1hLmEuQShhLmEuYmMoYiksYyk7MD5lP2QmJmIucHVzaChjKTpkfHxiLnNwbGljZShlLDEpfSxCYTpnLGV4dGVuZDpjLHNldFByb3RvdHlwZU9mOmQsQWI6Zz9kOmMsUDpiLEdhOmZ1bmN0aW9uKGEsYixjKXtpZighYSlyZXR1cm4gYTt2YXIgZD17fSxlO2ZvcihlIGluIGEpZi5jYWxsKGEsZSkmJihkW2VdPVxuYi5jYWxsKGMsYVtlXSxlLGEpKTtyZXR1cm4gZH0sVGI6ZnVuY3Rpb24oYil7Zm9yKDtiLmZpcnN0Q2hpbGQ7KWEucmVtb3ZlTm9kZShiLmZpcnN0Q2hpbGQpfSxZYjpmdW5jdGlvbihiKXtiPWEuYS5sYShiKTtmb3IodmFyIGM9KGJbMF0mJmJbMF0ub3duZXJEb2N1bWVudHx8dykuY3JlYXRlRWxlbWVudChcImRpdlwiKSxkPTAsZT1iLmxlbmd0aDtkPGU7ZCsrKWMuYXBwZW5kQ2hpbGQoYS5vYShiW2RdKSk7cmV0dXJuIGN9LENhOmZ1bmN0aW9uKGIsYyl7Zm9yKHZhciBkPTAsZT1iLmxlbmd0aCxsPVtdO2Q8ZTtkKyspe3ZhciBrPWJbZF0uY2xvbmVOb2RlKCEwKTtsLnB1c2goYz9hLm9hKGspOmspfXJldHVybiBsfSx2YTpmdW5jdGlvbihiLGMpe2EuYS5UYihiKTtpZihjKWZvcih2YXIgZD0wLGU9Yy5sZW5ndGg7ZDxlO2QrKyliLmFwcGVuZENoaWxkKGNbZF0pfSxYYzpmdW5jdGlvbihiLGMpe3ZhciBkPWIubm9kZVR5cGU/W2JdOmI7aWYoMDxkLmxlbmd0aCl7Zm9yKHZhciBlPWRbMF0sXG5sPWUucGFyZW50Tm9kZSxrPTAsZj1jLmxlbmd0aDtrPGY7aysrKWwuaW5zZXJ0QmVmb3JlKGNba10sZSk7az0wO2ZvcihmPWQubGVuZ3RoO2s8ZjtrKyspYS5yZW1vdmVOb2RlKGRba10pfX0sVWE6ZnVuY3Rpb24oYSxiKXtpZihhLmxlbmd0aCl7Zm9yKGI9OD09PWIubm9kZVR5cGUmJmIucGFyZW50Tm9kZXx8YjthLmxlbmd0aCYmYVswXS5wYXJlbnROb2RlIT09YjspYS5zcGxpY2UoMCwxKTtmb3IoOzE8YS5sZW5ndGgmJmFbYS5sZW5ndGgtMV0ucGFyZW50Tm9kZSE9PWI7KWEubGVuZ3RoLS07aWYoMTxhLmxlbmd0aCl7dmFyIGM9YVswXSxkPWFbYS5sZW5ndGgtMV07Zm9yKGEubGVuZ3RoPTA7YyE9PWQ7KWEucHVzaChjKSxjPWMubmV4dFNpYmxpbmc7YS5wdXNoKGQpfX1yZXR1cm4gYX0sWmM6ZnVuY3Rpb24oYSxiKXs3PnA/YS5zZXRBdHRyaWJ1dGUoXCJzZWxlY3RlZFwiLGIpOmEuc2VsZWN0ZWQ9Yn0sRGI6ZnVuY3Rpb24oYSl7cmV0dXJuIG51bGw9PT1hfHxhPT09bj9cIlwiOmEudHJpbT9cbmEudHJpbSgpOmEudG9TdHJpbmcoKS5yZXBsYWNlKC9eW1xcc1xceGEwXSt8W1xcc1xceGEwXSskL2csXCJcIil9LFVkOmZ1bmN0aW9uKGEsYil7YT1hfHxcIlwiO3JldHVybiBiLmxlbmd0aD5hLmxlbmd0aD8hMTphLnN1YnN0cmluZygwLGIubGVuZ3RoKT09PWJ9LHZkOmZ1bmN0aW9uKGEsYil7aWYoYT09PWIpcmV0dXJuITA7aWYoMTE9PT1hLm5vZGVUeXBlKXJldHVybiExO2lmKGIuY29udGFpbnMpcmV0dXJuIGIuY29udGFpbnMoMSE9PWEubm9kZVR5cGU/YS5wYXJlbnROb2RlOmEpO2lmKGIuY29tcGFyZURvY3VtZW50UG9zaXRpb24pcmV0dXJuIDE2PT0oYi5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihhKSYxNik7Zm9yKDthJiZhIT1iOylhPWEucGFyZW50Tm9kZTtyZXR1cm4hIWF9LFNiOmZ1bmN0aW9uKGIpe3JldHVybiBhLmEudmQoYixiLm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KX0sa2Q6ZnVuY3Rpb24oYil7cmV0dXJuISFhLmEuTGIoYixhLmEuU2IpfSxSOmZ1bmN0aW9uKGEpe3JldHVybiBhJiZcbmEudGFnTmFtZSYmYS50YWdOYW1lLnRvTG93ZXJDYXNlKCl9LEFjOmZ1bmN0aW9uKGIpe3JldHVybiBhLm9uRXJyb3I/ZnVuY3Rpb24oKXt0cnl7cmV0dXJuIGIuYXBwbHkodGhpcyxhcmd1bWVudHMpfWNhdGNoKGMpe3Rocm93IGEub25FcnJvciYmYS5vbkVycm9yKGMpLGM7fX06Yn0sc2V0VGltZW91dDpmdW5jdGlvbihiLGMpe3JldHVybiBzZXRUaW1lb3V0KGEuYS5BYyhiKSxjKX0sR2M6ZnVuY3Rpb24oYil7c2V0VGltZW91dChmdW5jdGlvbigpe2Eub25FcnJvciYmYS5vbkVycm9yKGIpO3Rocm93IGI7fSwwKX0sQjpmdW5jdGlvbihiLGMsZCl7dmFyIGU9YS5hLkFjKGQpO2Q9bFtjXTtpZihhLm9wdGlvbnMudXNlT25seU5hdGl2ZUV2ZW50c3x8ZHx8IXYpaWYoZHx8XCJmdW5jdGlvblwiIT10eXBlb2YgYi5hZGRFdmVudExpc3RlbmVyKWlmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBiLmF0dGFjaEV2ZW50KXt2YXIgaz1mdW5jdGlvbihhKXtlLmNhbGwoYixhKX0sZj1cIm9uXCIrYztiLmF0dGFjaEV2ZW50KGYsXG5rKTthLmEuSy56YShiLGZ1bmN0aW9uKCl7Yi5kZXRhY2hFdmVudChmLGspfSl9ZWxzZSB0aHJvdyBFcnJvcihcIkJyb3dzZXIgZG9lc24ndCBzdXBwb3J0IGFkZEV2ZW50TGlzdGVuZXIgb3IgYXR0YWNoRXZlbnRcIik7ZWxzZSBiLmFkZEV2ZW50TGlzdGVuZXIoYyxlLCExKTtlbHNlIHR8fCh0PVwiZnVuY3Rpb25cIj09dHlwZW9mIHYoYikub24/XCJvblwiOlwiYmluZFwiKSx2KGIpW3RdKGMsZSl9LEZiOmZ1bmN0aW9uKGIsYyl7aWYoIWJ8fCFiLm5vZGVUeXBlKXRocm93IEVycm9yKFwiZWxlbWVudCBtdXN0IGJlIGEgRE9NIG5vZGUgd2hlbiBjYWxsaW5nIHRyaWdnZXJFdmVudFwiKTt2YXIgZDtcImlucHV0XCI9PT1hLmEuUihiKSYmYi50eXBlJiZcImNsaWNrXCI9PWMudG9Mb3dlckNhc2UoKT8oZD1iLnR5cGUsZD1cImNoZWNrYm94XCI9PWR8fFwicmFkaW9cIj09ZCk6ZD0hMTtpZihhLm9wdGlvbnMudXNlT25seU5hdGl2ZUV2ZW50c3x8IXZ8fGQpaWYoXCJmdW5jdGlvblwiPT10eXBlb2Ygdy5jcmVhdGVFdmVudClpZihcImZ1bmN0aW9uXCI9PVxudHlwZW9mIGIuZGlzcGF0Y2hFdmVudClkPXcuY3JlYXRlRXZlbnQoa1tjXXx8XCJIVE1MRXZlbnRzXCIpLGQuaW5pdEV2ZW50KGMsITAsITAsQSwwLDAsMCwwLDAsITEsITEsITEsITEsMCxiKSxiLmRpc3BhdGNoRXZlbnQoZCk7ZWxzZSB0aHJvdyBFcnJvcihcIlRoZSBzdXBwbGllZCBlbGVtZW50IGRvZXNuJ3Qgc3VwcG9ydCBkaXNwYXRjaEV2ZW50XCIpO2Vsc2UgaWYoZCYmYi5jbGljayliLmNsaWNrKCk7ZWxzZSBpZihcInVuZGVmaW5lZFwiIT10eXBlb2YgYi5maXJlRXZlbnQpYi5maXJlRXZlbnQoXCJvblwiK2MpO2Vsc2UgdGhyb3cgRXJyb3IoXCJCcm93c2VyIGRvZXNuJ3Qgc3VwcG9ydCB0cmlnZ2VyaW5nIGV2ZW50c1wiKTtlbHNlIHYoYikudHJpZ2dlcihjKX0sZjpmdW5jdGlvbihiKXtyZXR1cm4gYS5PKGIpP2IoKTpifSxiYzpmdW5jdGlvbihiKXtyZXR1cm4gYS5PKGIpP2IudigpOmJ9LEViOmZ1bmN0aW9uKGIsYyxkKXt2YXIgbDtjJiYoXCJvYmplY3RcIj09PXR5cGVvZiBiLmNsYXNzTGlzdD9cbihsPWIuY2xhc3NMaXN0W2Q/XCJhZGRcIjpcInJlbW92ZVwiXSxhLmEuRChjLm1hdGNoKHEpLGZ1bmN0aW9uKGEpe2wuY2FsbChiLmNsYXNzTGlzdCxhKX0pKTpcInN0cmluZ1wiPT09dHlwZW9mIGIuY2xhc3NOYW1lLmJhc2VWYWw/ZShiLmNsYXNzTmFtZSxcImJhc2VWYWxcIixjLGQpOmUoYixcImNsYXNzTmFtZVwiLGMsZCkpfSxCYjpmdW5jdGlvbihiLGMpe3ZhciBkPWEuYS5mKGMpO2lmKG51bGw9PT1kfHxkPT09bilkPVwiXCI7dmFyIGU9YS5oLmZpcnN0Q2hpbGQoYik7IWV8fDMhPWUubm9kZVR5cGV8fGEuaC5uZXh0U2libGluZyhlKT9hLmgudmEoYixbYi5vd25lckRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGQpXSk6ZS5kYXRhPWQ7YS5hLkFkKGIpfSxZYzpmdW5jdGlvbihhLGIpe2EubmFtZT1iO2lmKDc+PXApdHJ5e3ZhciBjPWEubmFtZS5yZXBsYWNlKC9bJjw+J1wiXS9nLGZ1bmN0aW9uKGEpe3JldHVyblwiJiNcIithLmNoYXJDb2RlQXQoMCkrXCI7XCJ9KTthLm1lcmdlQXR0cmlidXRlcyh3LmNyZWF0ZUVsZW1lbnQoXCI8aW5wdXQgbmFtZT0nXCIrXG5jK1wiJy8+XCIpLCExKX1jYXRjaChkKXt9fSxBZDpmdW5jdGlvbihhKXs5PD1wJiYoYT0xPT1hLm5vZGVUeXBlP2E6YS5wYXJlbnROb2RlLGEuc3R5bGUmJihhLnN0eWxlLnpvb209YS5zdHlsZS56b29tKSl9LHdkOmZ1bmN0aW9uKGEpe2lmKHApe3ZhciBiPWEuc3R5bGUud2lkdGg7YS5zdHlsZS53aWR0aD0wO2Euc3R5bGUud2lkdGg9Yn19LFBkOmZ1bmN0aW9uKGIsYyl7Yj1hLmEuZihiKTtjPWEuYS5mKGMpO2Zvcih2YXIgZD1bXSxlPWI7ZTw9YztlKyspZC5wdXNoKGUpO3JldHVybiBkfSxsYTpmdW5jdGlvbihhKXtmb3IodmFyIGI9W10sYz0wLGQ9YS5sZW5ndGg7YzxkO2MrKyliLnB1c2goYVtjXSk7cmV0dXJuIGJ9LERhOmZ1bmN0aW9uKGEpe3JldHVybiBoP1N5bWJvbChhKTphfSxaZDo2PT09cCwkZDo3PT09cCxXOnAsTGM6ZnVuY3Rpb24oYixjKXtmb3IodmFyIGQ9YS5hLmxhKGIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbnB1dFwiKSkuY29uY2F0KGEuYS5sYShiLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwidGV4dGFyZWFcIikpKSxcbmU9XCJzdHJpbmdcIj09dHlwZW9mIGM/ZnVuY3Rpb24oYSl7cmV0dXJuIGEubmFtZT09PWN9OmZ1bmN0aW9uKGEpe3JldHVybiBjLnRlc3QoYS5uYW1lKX0sbD1bXSxrPWQubGVuZ3RoLTE7MDw9aztrLS0pZShkW2tdKSYmbC5wdXNoKGRba10pO3JldHVybiBsfSxOZDpmdW5jdGlvbihiKXtyZXR1cm5cInN0cmluZ1wiPT10eXBlb2YgYiYmKGI9YS5hLkRiKGIpKT9IJiZILnBhcnNlP0gucGFyc2UoYik6KG5ldyBGdW5jdGlvbihcInJldHVybiBcIitiKSkoKTpudWxsfSxoYzpmdW5jdGlvbihiLGMsZCl7aWYoIUh8fCFILnN0cmluZ2lmeSl0aHJvdyBFcnJvcihcIkNhbm5vdCBmaW5kIEpTT04uc3RyaW5naWZ5KCkuIFNvbWUgYnJvd3NlcnMgKGUuZy4sIElFIDwgOCkgZG9uJ3Qgc3VwcG9ydCBpdCBuYXRpdmVseSwgYnV0IHlvdSBjYW4gb3ZlcmNvbWUgdGhpcyBieSBhZGRpbmcgYSBzY3JpcHQgcmVmZXJlbmNlIHRvIGpzb24yLmpzLCBkb3dubG9hZGFibGUgZnJvbSBodHRwOi8vd3d3Lmpzb24ub3JnL2pzb24yLmpzXCIpO1xucmV0dXJuIEguc3RyaW5naWZ5KGEuYS5mKGIpLGMsZCl9LE9kOmZ1bmN0aW9uKGMsZCxlKXtlPWV8fHt9O3ZhciBsPWUucGFyYW1zfHx7fSxrPWUuaW5jbHVkZUZpZWxkc3x8dGhpcy5KYyxmPWM7aWYoXCJvYmplY3RcIj09dHlwZW9mIGMmJlwiZm9ybVwiPT09YS5hLlIoYykpZm9yKHZhciBmPWMuYWN0aW9uLGg9ay5sZW5ndGgtMTswPD1oO2gtLSlmb3IodmFyIGc9YS5hLkxjKGMsa1toXSksbT1nLmxlbmd0aC0xOzA8PW07bS0tKWxbZ1ttXS5uYW1lXT1nW21dLnZhbHVlO2Q9YS5hLmYoZCk7dmFyIHA9dy5jcmVhdGVFbGVtZW50KFwiZm9ybVwiKTtwLnN0eWxlLmRpc3BsYXk9XCJub25lXCI7cC5hY3Rpb249ZjtwLm1ldGhvZD1cInBvc3RcIjtmb3IodmFyIHEgaW4gZCljPXcuY3JlYXRlRWxlbWVudChcImlucHV0XCIpLGMudHlwZT1cImhpZGRlblwiLGMubmFtZT1xLGMudmFsdWU9YS5hLmhjKGEuYS5mKGRbcV0pKSxwLmFwcGVuZENoaWxkKGMpO2IobCxmdW5jdGlvbihhLGIpe3ZhciBjPXcuY3JlYXRlRWxlbWVudChcImlucHV0XCIpO1xuYy50eXBlPVwiaGlkZGVuXCI7Yy5uYW1lPWE7Yy52YWx1ZT1iO3AuYXBwZW5kQ2hpbGQoYyl9KTt3LmJvZHkuYXBwZW5kQ2hpbGQocCk7ZS5zdWJtaXR0ZXI/ZS5zdWJtaXR0ZXIocCk6cC5zdWJtaXQoKTtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7cC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHApfSwwKX19fSgpO2EuYihcInV0aWxzXCIsYS5hKTthLmIoXCJ1dGlscy5hcnJheUZvckVhY2hcIixhLmEuRCk7YS5iKFwidXRpbHMuYXJyYXlGaXJzdFwiLGEuYS5MYik7YS5iKFwidXRpbHMuYXJyYXlGaWx0ZXJcIixhLmEuamIpO2EuYihcInV0aWxzLmFycmF5R2V0RGlzdGluY3RWYWx1ZXNcIixhLmEud2MpO2EuYihcInV0aWxzLmFycmF5SW5kZXhPZlwiLGEuYS5BKTthLmIoXCJ1dGlscy5hcnJheU1hcFwiLGEuYS5NYik7YS5iKFwidXRpbHMuYXJyYXlQdXNoQWxsXCIsYS5hLk5iKTthLmIoXCJ1dGlscy5hcnJheVJlbW92ZUl0ZW1cIixhLmEuUGEpO2EuYihcInV0aWxzLmNsb25lTm9kZXNcIixhLmEuQ2EpO2EuYihcInV0aWxzLmNyZWF0ZVN5bWJvbE9yU3RyaW5nXCIsXG5hLmEuRGEpO2EuYihcInV0aWxzLmV4dGVuZFwiLGEuYS5leHRlbmQpO2EuYihcInV0aWxzLmZpZWxkc0luY2x1ZGVkV2l0aEpzb25Qb3N0XCIsYS5hLkpjKTthLmIoXCJ1dGlscy5nZXRGb3JtRmllbGRzXCIsYS5hLkxjKTthLmIoXCJ1dGlscy5vYmplY3RNYXBcIixhLmEuR2EpO2EuYihcInV0aWxzLnBlZWtPYnNlcnZhYmxlXCIsYS5hLmJjKTthLmIoXCJ1dGlscy5wb3N0SnNvblwiLGEuYS5PZCk7YS5iKFwidXRpbHMucGFyc2VKc29uXCIsYS5hLk5kKTthLmIoXCJ1dGlscy5yZWdpc3RlckV2ZW50SGFuZGxlclwiLGEuYS5CKTthLmIoXCJ1dGlscy5zdHJpbmdpZnlKc29uXCIsYS5hLmhjKTthLmIoXCJ1dGlscy5yYW5nZVwiLGEuYS5QZCk7YS5iKFwidXRpbHMudG9nZ2xlRG9tTm9kZUNzc0NsYXNzXCIsYS5hLkViKTthLmIoXCJ1dGlscy50cmlnZ2VyRXZlbnRcIixhLmEuRmIpO2EuYihcInV0aWxzLnVud3JhcE9ic2VydmFibGVcIixhLmEuZik7YS5iKFwidXRpbHMub2JqZWN0Rm9yRWFjaFwiLGEuYS5QKTthLmIoXCJ1dGlscy5hZGRPclJlbW92ZUl0ZW1cIixcbmEuYS5OYSk7YS5iKFwidXRpbHMuc2V0VGV4dENvbnRlbnRcIixhLmEuQmIpO2EuYihcInVud3JhcFwiLGEuYS5mKTtGdW5jdGlvbi5wcm90b3R5cGUuYmluZHx8KEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kPWZ1bmN0aW9uKGEpe3ZhciBjPXRoaXM7aWYoMT09PWFyZ3VtZW50cy5sZW5ndGgpcmV0dXJuIGZ1bmN0aW9uKCl7cmV0dXJuIGMuYXBwbHkoYSxhcmd1bWVudHMpfTt2YXIgZD1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMSk7cmV0dXJuIGZ1bmN0aW9uKCl7dmFyIGU9ZC5zbGljZSgwKTtlLnB1c2guYXBwbHkoZSxhcmd1bWVudHMpO3JldHVybiBjLmFwcGx5KGEsZSl9fSk7YS5hLmc9bmV3IGZ1bmN0aW9uKCl7dmFyIGI9MCxjPVwiX19rb19fXCIrKG5ldyBEYXRlKS5nZXRUaW1lKCksZD17fSxlLGY7YS5hLlc/KGU9ZnVuY3Rpb24oYSxlKXt2YXIgZj1hW2NdO2lmKCFmfHxcIm51bGxcIj09PWZ8fCFkW2ZdKXtpZighZSlyZXR1cm4gbjtmPWFbY109XCJrb1wiK2IrKztkW2ZdPVxue319cmV0dXJuIGRbZl19LGY9ZnVuY3Rpb24oYSl7dmFyIGI9YVtjXTtyZXR1cm4gYj8oZGVsZXRlIGRbYl0sYVtjXT1udWxsLCEwKTohMX0pOihlPWZ1bmN0aW9uKGEsYil7dmFyIGQ9YVtjXTshZCYmYiYmKGQ9YVtjXT17fSk7cmV0dXJuIGR9LGY9ZnVuY3Rpb24oYSl7cmV0dXJuIGFbY10/KGRlbGV0ZSBhW2NdLCEwKTohMX0pO3JldHVybntnZXQ6ZnVuY3Rpb24oYSxiKXt2YXIgYz1lKGEsITEpO3JldHVybiBjJiZjW2JdfSxzZXQ6ZnVuY3Rpb24oYSxiLGMpeyhhPWUoYSxjIT09bikpJiYoYVtiXT1jKX0sVWI6ZnVuY3Rpb24oYSxiLGMpe2E9ZShhLCEwKTtyZXR1cm4gYVtiXXx8KGFbYl09Yyl9LGNsZWFyOmYsWjpmdW5jdGlvbigpe3JldHVybiBiKysgK2N9fX07YS5iKFwidXRpbHMuZG9tRGF0YVwiLGEuYS5nKTthLmIoXCJ1dGlscy5kb21EYXRhLmNsZWFyXCIsYS5hLmcuY2xlYXIpO2EuYS5LPW5ldyBmdW5jdGlvbigpe2Z1bmN0aW9uIGIoYixjKXt2YXIgZD1hLmEuZy5nZXQoYixlKTtcbmQ9PT1uJiZjJiYoZD1bXSxhLmEuZy5zZXQoYixlLGQpKTtyZXR1cm4gZH1mdW5jdGlvbiBjKGMpe3ZhciBlPWIoYywhMSk7aWYoZSlmb3IodmFyIGU9ZS5zbGljZSgwKSxrPTA7azxlLmxlbmd0aDtrKyspZVtrXShjKTthLmEuZy5jbGVhcihjKTthLmEuSy5jbGVhbkV4dGVybmFsRGF0YShjKTtnW2Mubm9kZVR5cGVdJiZkKGMuY2hpbGROb2RlcywhMCl9ZnVuY3Rpb24gZChiLGQpe2Zvcih2YXIgZT1bXSxsLGY9MDtmPGIubGVuZ3RoO2YrKylpZighZHx8OD09PWJbZl0ubm9kZVR5cGUpaWYoYyhlW2UubGVuZ3RoXT1sPWJbZl0pLGJbZl0hPT1sKWZvcig7Zi0tJiYtMT09YS5hLkEoZSxiW2ZdKTspO312YXIgZT1hLmEuZy5aKCksZj17MTohMCw4OiEwLDk6ITB9LGc9ezE6ITAsOTohMH07cmV0dXJue3phOmZ1bmN0aW9uKGEsYyl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgYyl0aHJvdyBFcnJvcihcIkNhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvblwiKTtiKGEsITApLnB1c2goYyl9LHliOmZ1bmN0aW9uKGMsXG5kKXt2YXIgZj1iKGMsITEpO2YmJihhLmEuUGEoZixkKSwwPT1mLmxlbmd0aCYmYS5hLmcuc2V0KGMsZSxuKSl9LG9hOmZ1bmN0aW9uKGIpe2EudS5HKGZ1bmN0aW9uKCl7ZltiLm5vZGVUeXBlXSYmKGMoYiksZ1tiLm5vZGVUeXBlXSYmZChiLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiKlwiKSkpfSk7cmV0dXJuIGJ9LHJlbW92ZU5vZGU6ZnVuY3Rpb24oYil7YS5vYShiKTtiLnBhcmVudE5vZGUmJmIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChiKX0sY2xlYW5FeHRlcm5hbERhdGE6ZnVuY3Rpb24oYSl7diYmXCJmdW5jdGlvblwiPT10eXBlb2Ygdi5jbGVhbkRhdGEmJnYuY2xlYW5EYXRhKFthXSl9fX07YS5vYT1hLmEuSy5vYTthLnJlbW92ZU5vZGU9YS5hLksucmVtb3ZlTm9kZTthLmIoXCJjbGVhbk5vZGVcIixhLm9hKTthLmIoXCJyZW1vdmVOb2RlXCIsYS5yZW1vdmVOb2RlKTthLmIoXCJ1dGlscy5kb21Ob2RlRGlzcG9zYWxcIixhLmEuSyk7YS5iKFwidXRpbHMuZG9tTm9kZURpc3Bvc2FsLmFkZERpc3Bvc2VDYWxsYmFja1wiLFxuYS5hLksuemEpO2EuYihcInV0aWxzLmRvbU5vZGVEaXNwb3NhbC5yZW1vdmVEaXNwb3NlQ2FsbGJhY2tcIixhLmEuSy55Yik7KGZ1bmN0aW9uKCl7dmFyIGI9WzAsXCJcIixcIlwiXSxjPVsxLFwiPHRhYmxlPlwiLFwiPC90YWJsZT5cIl0sZD1bMyxcIjx0YWJsZT48dGJvZHk+PHRyPlwiLFwiPC90cj48L3Rib2R5PjwvdGFibGU+XCJdLGU9WzEsXCI8c2VsZWN0IG11bHRpcGxlPSdtdWx0aXBsZSc+XCIsXCI8L3NlbGVjdD5cIl0sZj17dGhlYWQ6Yyx0Ym9keTpjLHRmb290OmMsdHI6WzIsXCI8dGFibGU+PHRib2R5PlwiLFwiPC90Ym9keT48L3RhYmxlPlwiXSx0ZDpkLHRoOmQsb3B0aW9uOmUsb3B0Z3JvdXA6ZX0sZz04Pj1hLmEuVzthLmEudWE9ZnVuY3Rpb24oYyxkKXt2YXIgZTtpZih2KWlmKHYucGFyc2VIVE1MKWU9di5wYXJzZUhUTUwoYyxkKXx8W107ZWxzZXtpZigoZT12LmNsZWFuKFtjXSxkKSkmJmVbMF0pe2Zvcih2YXIgbD1lWzBdO2wucGFyZW50Tm9kZSYmMTEhPT1sLnBhcmVudE5vZGUubm9kZVR5cGU7KWw9bC5wYXJlbnROb2RlO1xubC5wYXJlbnROb2RlJiZsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobCl9fWVsc2V7KGU9ZCl8fChlPXcpO3ZhciBsPWUucGFyZW50V2luZG93fHxlLmRlZmF1bHRWaWV3fHxBLHA9YS5hLkRiKGMpLnRvTG93ZXJDYXNlKCkscT1lLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksdDt0PShwPXAubWF0Y2goL14oPzpcXHgzYyEtLS4qPy0tXFx4M2VcXHMqPykqPzwoW2Etel0rKVtcXHM+XS8pKSYmZltwWzFdXXx8YjtwPXRbMF07dD1cImlnbm9yZWQ8ZGl2PlwiK3RbMV0rYyt0WzJdK1wiPC9kaXY+XCI7XCJmdW5jdGlvblwiPT10eXBlb2YgbC5pbm5lclNoaXY/cS5hcHBlbmRDaGlsZChsLmlubmVyU2hpdih0KSk6KGcmJmUuYm9keS5hcHBlbmRDaGlsZChxKSxxLmlubmVySFRNTD10LGcmJnEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChxKSk7Zm9yKDtwLS07KXE9cS5sYXN0Q2hpbGQ7ZT1hLmEubGEocS5sYXN0Q2hpbGQuY2hpbGROb2Rlcyl9cmV0dXJuIGV9O2EuYS5NZD1mdW5jdGlvbihiLGMpe3ZhciBkPWEuYS51YShiLFxuYyk7cmV0dXJuIGQubGVuZ3RoJiZkWzBdLnBhcmVudEVsZW1lbnR8fGEuYS5ZYihkKX07YS5hLmZjPWZ1bmN0aW9uKGIsYyl7YS5hLlRiKGIpO2M9YS5hLmYoYyk7aWYobnVsbCE9PWMmJmMhPT1uKWlmKFwic3RyaW5nXCIhPXR5cGVvZiBjJiYoYz1jLnRvU3RyaW5nKCkpLHYpdihiKS5odG1sKGMpO2Vsc2UgZm9yKHZhciBkPWEuYS51YShjLGIub3duZXJEb2N1bWVudCksZT0wO2U8ZC5sZW5ndGg7ZSsrKWIuYXBwZW5kQ2hpbGQoZFtlXSl9fSkoKTthLmIoXCJ1dGlscy5wYXJzZUh0bWxGcmFnbWVudFwiLGEuYS51YSk7YS5iKFwidXRpbHMuc2V0SHRtbFwiLGEuYS5mYyk7YS5hYT1mdW5jdGlvbigpe2Z1bmN0aW9uIGIoYyxlKXtpZihjKWlmKDg9PWMubm9kZVR5cGUpe3ZhciBmPWEuYWEuVWMoYy5ub2RlVmFsdWUpO251bGwhPWYmJmUucHVzaCh7dWQ6YyxLZDpmfSl9ZWxzZSBpZigxPT1jLm5vZGVUeXBlKWZvcih2YXIgZj0wLGc9Yy5jaGlsZE5vZGVzLGg9Zy5sZW5ndGg7ZjxoO2YrKyliKGdbZl0sXG5lKX12YXIgYz17fTtyZXR1cm57WGI6ZnVuY3Rpb24oYSl7aWYoXCJmdW5jdGlvblwiIT10eXBlb2YgYSl0aHJvdyBFcnJvcihcIllvdSBjYW4gb25seSBwYXNzIGEgZnVuY3Rpb24gdG8ga28ubWVtb2l6YXRpb24ubWVtb2l6ZSgpXCIpO3ZhciBiPSg0Mjk0OTY3Mjk2KigxK01hdGgucmFuZG9tKCkpfDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSkrKDQyOTQ5NjcyOTYqKDErTWF0aC5yYW5kb20oKSl8MCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygxKTtjW2JdPWE7cmV0dXJuXCJcXHgzYyEtLVtrb19tZW1vOlwiK2IrXCJdLS1cXHgzZVwifSxiZDpmdW5jdGlvbihhLGIpe3ZhciBmPWNbYV07aWYoZj09PW4pdGhyb3cgRXJyb3IoXCJDb3VsZG4ndCBmaW5kIGFueSBtZW1vIHdpdGggSUQgXCIrYStcIi4gUGVyaGFwcyBpdCdzIGFscmVhZHkgYmVlbiB1bm1lbW9pemVkLlwiKTt0cnl7cmV0dXJuIGYuYXBwbHkobnVsbCxifHxbXSksITB9ZmluYWxseXtkZWxldGUgY1thXX19LGNkOmZ1bmN0aW9uKGMsZSl7dmFyIGY9XG5bXTtiKGMsZik7Zm9yKHZhciBnPTAsaD1mLmxlbmd0aDtnPGg7ZysrKXt2YXIgbT1mW2ddLnVkLGs9W21dO2UmJmEuYS5OYihrLGUpO2EuYWEuYmQoZltnXS5LZCxrKTttLm5vZGVWYWx1ZT1cIlwiO20ucGFyZW50Tm9kZSYmbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG0pfX0sVWM6ZnVuY3Rpb24oYSl7cmV0dXJuKGE9YS5tYXRjaCgvXlxcW2tvX21lbW9cXDooLio/KVxcXSQvKSk/YVsxXTpudWxsfX19KCk7YS5iKFwibWVtb2l6YXRpb25cIixhLmFhKTthLmIoXCJtZW1vaXphdGlvbi5tZW1vaXplXCIsYS5hYS5YYik7YS5iKFwibWVtb2l6YXRpb24udW5tZW1vaXplXCIsYS5hYS5iZCk7YS5iKFwibWVtb2l6YXRpb24ucGFyc2VNZW1vVGV4dFwiLGEuYWEuVWMpO2EuYihcIm1lbW9pemF0aW9uLnVubWVtb2l6ZURvbU5vZGVBbmREZXNjZW5kYW50c1wiLGEuYWEuY2QpO2EubmE9ZnVuY3Rpb24oKXtmdW5jdGlvbiBiKCl7aWYoZilmb3IodmFyIGI9ZixjPTAsZDtoPGY7KWlmKGQ9ZVtoKytdKXtpZihoPmIpe2lmKDVFMzw9XG4rK2Mpe2g9ZjthLmEuR2MoRXJyb3IoXCInVG9vIG11Y2ggcmVjdXJzaW9uJyBhZnRlciBwcm9jZXNzaW5nIFwiK2MrXCIgdGFzayBncm91cHMuXCIpKTticmVha31iPWZ9dHJ5e2QoKX1jYXRjaChwKXthLmEuR2MocCl9fX1mdW5jdGlvbiBjKCl7YigpO2g9Zj1lLmxlbmd0aD0wfXZhciBkLGU9W10sZj0wLGc9MSxoPTA7QS5NdXRhdGlvbk9ic2VydmVyP2Q9ZnVuY3Rpb24oYSl7dmFyIGI9dy5jcmVhdGVFbGVtZW50KFwiZGl2XCIpOyhuZXcgTXV0YXRpb25PYnNlcnZlcihhKSkub2JzZXJ2ZShiLHthdHRyaWJ1dGVzOiEwfSk7cmV0dXJuIGZ1bmN0aW9uKCl7Yi5jbGFzc0xpc3QudG9nZ2xlKFwiZm9vXCIpfX0oYyk6ZD13JiZcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiaW4gdy5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpP2Z1bmN0aW9uKGEpe3ZhciBiPXcuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtiLm9ucmVhZHlzdGF0ZWNoYW5nZT1mdW5jdGlvbigpe2Iub25yZWFkeXN0YXRlY2hhbmdlPW51bGw7dy5kb2N1bWVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoYik7XG5iPW51bGw7YSgpfTt3LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChiKX06ZnVuY3Rpb24oYSl7c2V0VGltZW91dChhLDApfTtyZXR1cm57c2NoZWR1bGVyOmQsemI6ZnVuY3Rpb24oYil7Znx8YS5uYS5zY2hlZHVsZXIoYyk7ZVtmKytdPWI7cmV0dXJuIGcrK30sY2FuY2VsOmZ1bmN0aW9uKGEpe2E9YS0oZy1mKTthPj1oJiZhPGYmJihlW2FdPW51bGwpfSxyZXNldEZvclRlc3Rpbmc6ZnVuY3Rpb24oKXt2YXIgYT1mLWg7aD1mPWUubGVuZ3RoPTA7cmV0dXJuIGF9LFNkOmJ9fSgpO2EuYihcInRhc2tzXCIsYS5uYSk7YS5iKFwidGFza3Muc2NoZWR1bGVcIixhLm5hLnpiKTthLmIoXCJ0YXNrcy5ydW5FYXJseVwiLGEubmEuU2QpO2EuVGE9e3Rocm90dGxlOmZ1bmN0aW9uKGIsYyl7Yi50aHJvdHRsZUV2YWx1YXRpb249Yzt2YXIgZD1udWxsO3JldHVybiBhLiQoe3JlYWQ6Yix3cml0ZTpmdW5jdGlvbihlKXtjbGVhclRpbWVvdXQoZCk7ZD1hLmEuc2V0VGltZW91dChmdW5jdGlvbigpe2IoZSl9LFxuYyl9fSl9LHJhdGVMaW1pdDpmdW5jdGlvbihhLGMpe3ZhciBkLGUsZjtcIm51bWJlclwiPT10eXBlb2YgYz9kPWM6KGQ9Yy50aW1lb3V0LGU9Yy5tZXRob2QpO2EuSGI9ITE7Zj1cImZ1bmN0aW9uXCI9PXR5cGVvZiBlP2U6XCJub3RpZnlXaGVuQ2hhbmdlc1N0b3BcIj09ZT9ZOlg7YS51YihmdW5jdGlvbihhKXtyZXR1cm4gZihhLGQsYyl9KX0sZGVmZXJyZWQ6ZnVuY3Rpb24oYixjKXtpZighMCE9PWMpdGhyb3cgRXJyb3IoXCJUaGUgJ2RlZmVycmVkJyBleHRlbmRlciBvbmx5IGFjY2VwdHMgdGhlIHZhbHVlICd0cnVlJywgYmVjYXVzZSBpdCBpcyBub3Qgc3VwcG9ydGVkIHRvIHR1cm4gZGVmZXJyYWwgb2ZmIG9uY2UgZW5hYmxlZC5cIik7Yi5IYnx8KGIuSGI9ITAsYi51YihmdW5jdGlvbihjKXt2YXIgZSxmPSExO3JldHVybiBmdW5jdGlvbigpe2lmKCFmKXthLm5hLmNhbmNlbChlKTtlPWEubmEuemIoYyk7dHJ5e2Y9ITAsYi5ub3RpZnlTdWJzY3JpYmVycyhuLFwiZGlydHlcIil9ZmluYWxseXtmPVxuITF9fX19KSl9LG5vdGlmeTpmdW5jdGlvbihhLGMpe2EuZXF1YWxpdHlDb21wYXJlcj1cImFsd2F5c1wiPT1jP251bGw6S319O3ZhciBXPXt1bmRlZmluZWQ6MSxcImJvb2xlYW5cIjoxLG51bWJlcjoxLHN0cmluZzoxfTthLmIoXCJleHRlbmRlcnNcIixhLlRhKTthLmljPWZ1bmN0aW9uKGIsYyxkKXt0aGlzLmRhPWI7dGhpcy5sYz1jO3RoaXMubWM9ZDt0aGlzLkliPSExO3RoaXMuZmI9dGhpcy5KYj1udWxsO2EuTCh0aGlzLFwiZGlzcG9zZVwiLHRoaXMucyk7YS5MKHRoaXMsXCJkaXNwb3NlV2hlbk5vZGVJc1JlbW92ZWRcIix0aGlzLmwpfTthLmljLnByb3RvdHlwZS5zPWZ1bmN0aW9uKCl7dGhpcy5JYnx8KHRoaXMuZmImJmEuYS5LLnliKHRoaXMuSmIsdGhpcy5mYiksdGhpcy5JYj0hMCx0aGlzLm1jKCksdGhpcy5kYT10aGlzLmxjPXRoaXMubWM9dGhpcy5KYj10aGlzLmZiPW51bGwpfTthLmljLnByb3RvdHlwZS5sPWZ1bmN0aW9uKGIpe3RoaXMuSmI9YjthLmEuSy56YShiLHRoaXMuZmI9dGhpcy5zLmJpbmQodGhpcykpfTtcbmEuVD1mdW5jdGlvbigpe2EuYS5BYih0aGlzLEQpO0QucWIodGhpcyl9O3ZhciBEPXtxYjpmdW5jdGlvbihhKXthLlU9e2NoYW5nZTpbXX07YS5zYz0xfSxzdWJzY3JpYmU6ZnVuY3Rpb24oYixjLGQpe3ZhciBlPXRoaXM7ZD1kfHxcImNoYW5nZVwiO3ZhciBmPW5ldyBhLmljKGUsYz9iLmJpbmQoYyk6YixmdW5jdGlvbigpe2EuYS5QYShlLlVbZF0sZik7ZS5oYiYmZS5oYihkKX0pO2UuUWEmJmUuUWEoZCk7ZS5VW2RdfHwoZS5VW2RdPVtdKTtlLlVbZF0ucHVzaChmKTtyZXR1cm4gZn0sbm90aWZ5U3Vic2NyaWJlcnM6ZnVuY3Rpb24oYixjKXtjPWN8fFwiY2hhbmdlXCI7XCJjaGFuZ2VcIj09PWMmJnRoaXMuR2IoKTtpZih0aGlzLldhKGMpKXt2YXIgZD1cImNoYW5nZVwiPT09YyYmdGhpcy5lZHx8dGhpcy5VW2NdLnNsaWNlKDApO3RyeXthLnUueGMoKTtmb3IodmFyIGU9MCxmO2Y9ZFtlXTsrK2UpZi5JYnx8Zi5sYyhiKX1maW5hbGx5e2EudS5lbmQoKX19fSxvYjpmdW5jdGlvbigpe3JldHVybiB0aGlzLnNjfSxcbkRkOmZ1bmN0aW9uKGEpe3JldHVybiB0aGlzLm9iKCkhPT1hfSxHYjpmdW5jdGlvbigpeysrdGhpcy5zY30sdWI6ZnVuY3Rpb24oYil7dmFyIGM9dGhpcyxkPWEuTyhjKSxlLGYsZyxoLG07Yy5nYnx8KGMuZ2I9Yy5ub3RpZnlTdWJzY3JpYmVycyxjLm5vdGlmeVN1YnNjcmliZXJzPVopO3ZhciBrPWIoZnVuY3Rpb24oKXtjLkphPSExO2QmJmg9PT1jJiYoaD1jLm5jP2MubmMoKTpjKCkpO3ZhciBhPWZ8fG0mJmMuc2IoZyxoKTttPWY9ZT0hMTthJiZjLmdiKGc9aCl9KTtjLnFjPWZ1bmN0aW9uKGEsYil7YiYmYy5KYXx8KG09IWIpO2MuZWQ9Yy5VLmNoYW5nZS5zbGljZSgwKTtjLkphPWU9ITA7aD1hO2soKX07Yy5wYz1mdW5jdGlvbihhKXtlfHwoZz1hLGMuZ2IoYSxcImJlZm9yZUNoYW5nZVwiKSl9O2MucmM9ZnVuY3Rpb24oKXttPSEwfTtjLmdkPWZ1bmN0aW9uKCl7Yy5zYihnLGMudighMCkpJiYoZj0hMCl9fSxXYTpmdW5jdGlvbihhKXtyZXR1cm4gdGhpcy5VW2FdJiZ0aGlzLlVbYV0ubGVuZ3RofSxcbkJkOmZ1bmN0aW9uKGIpe2lmKGIpcmV0dXJuIHRoaXMuVVtiXSYmdGhpcy5VW2JdLmxlbmd0aHx8MDt2YXIgYz0wO2EuYS5QKHRoaXMuVSxmdW5jdGlvbihhLGIpe1wiZGlydHlcIiE9PWEmJihjKz1iLmxlbmd0aCl9KTtyZXR1cm4gY30sc2I6ZnVuY3Rpb24oYSxjKXtyZXR1cm4hdGhpcy5lcXVhbGl0eUNvbXBhcmVyfHwhdGhpcy5lcXVhbGl0eUNvbXBhcmVyKGEsYyl9LHRvU3RyaW5nOmZ1bmN0aW9uKCl7cmV0dXJuXCJbb2JqZWN0IE9iamVjdF1cIn0sZXh0ZW5kOmZ1bmN0aW9uKGIpe3ZhciBjPXRoaXM7YiYmYS5hLlAoYixmdW5jdGlvbihiLGUpe3ZhciBmPWEuVGFbYl07XCJmdW5jdGlvblwiPT10eXBlb2YgZiYmKGM9ZihjLGUpfHxjKX0pO3JldHVybiBjfX07YS5MKEQsXCJpbml0XCIsRC5xYik7YS5MKEQsXCJzdWJzY3JpYmVcIixELnN1YnNjcmliZSk7YS5MKEQsXCJleHRlbmRcIixELmV4dGVuZCk7YS5MKEQsXCJnZXRTdWJzY3JpcHRpb25zQ291bnRcIixELkJkKTthLmEuQmEmJmEuYS5zZXRQcm90b3R5cGVPZihELFxuRnVuY3Rpb24ucHJvdG90eXBlKTthLlQuZm49RDthLlFjPWZ1bmN0aW9uKGEpe3JldHVybiBudWxsIT1hJiZcImZ1bmN0aW9uXCI9PXR5cGVvZiBhLnN1YnNjcmliZSYmXCJmdW5jdGlvblwiPT10eXBlb2YgYS5ub3RpZnlTdWJzY3JpYmVyc307YS5iKFwic3Vic2NyaWJhYmxlXCIsYS5UKTthLmIoXCJpc1N1YnNjcmliYWJsZVwiLGEuUWMpO2EuUz1hLnU9ZnVuY3Rpb24oKXtmdW5jdGlvbiBiKGEpe2QucHVzaChlKTtlPWF9ZnVuY3Rpb24gYygpe2U9ZC5wb3AoKX12YXIgZD1bXSxlLGY9MDtyZXR1cm57eGM6YixlbmQ6YyxjYzpmdW5jdGlvbihiKXtpZihlKXtpZighYS5RYyhiKSl0aHJvdyBFcnJvcihcIk9ubHkgc3Vic2NyaWJhYmxlIHRoaW5ncyBjYW4gYWN0IGFzIGRlcGVuZGVuY2llc1wiKTtlLm9kLmNhbGwoZS5wZCxiLGIuZmR8fChiLmZkPSsrZikpfX0sRzpmdW5jdGlvbihhLGQsZSl7dHJ5e3JldHVybiBiKCksYS5hcHBseShkLGV8fFtdKX1maW5hbGx5e2MoKX19LHFhOmZ1bmN0aW9uKCl7aWYoZSlyZXR1cm4gZS5vLnFhKCl9LFxuVmE6ZnVuY3Rpb24oKXtpZihlKXJldHVybiBlLm8uVmEoKX0sWWE6ZnVuY3Rpb24oKXtpZihlKXJldHVybiBlLllhfSxvOmZ1bmN0aW9uKCl7aWYoZSlyZXR1cm4gZS5vfX19KCk7YS5iKFwiY29tcHV0ZWRDb250ZXh0XCIsYS5TKTthLmIoXCJjb21wdXRlZENvbnRleHQuZ2V0RGVwZW5kZW5jaWVzQ291bnRcIixhLlMucWEpO2EuYihcImNvbXB1dGVkQ29udGV4dC5nZXREZXBlbmRlbmNpZXNcIixhLlMuVmEpO2EuYihcImNvbXB1dGVkQ29udGV4dC5pc0luaXRpYWxcIixhLlMuWWEpO2EuYihcImNvbXB1dGVkQ29udGV4dC5yZWdpc3RlckRlcGVuZGVuY3lcIixhLlMuY2MpO2EuYihcImlnbm9yZURlcGVuZGVuY2llc1wiLGEuWWQ9YS51LkcpO3ZhciBJPWEuYS5EYShcIl9sYXRlc3RWYWx1ZVwiKTthLnRhPWZ1bmN0aW9uKGIpe2Z1bmN0aW9uIGMoKXtpZigwPGFyZ3VtZW50cy5sZW5ndGgpcmV0dXJuIGMuc2IoY1tJXSxhcmd1bWVudHNbMF0pJiYoYy55YSgpLGNbSV09YXJndW1lbnRzWzBdLGMueGEoKSksdGhpcztcbmEudS5jYyhjKTtyZXR1cm4gY1tJXX1jW0ldPWI7YS5hLkJhfHxhLmEuZXh0ZW5kKGMsYS5ULmZuKTthLlQuZm4ucWIoYyk7YS5hLkFiKGMsRik7YS5vcHRpb25zLmRlZmVyVXBkYXRlcyYmYS5UYS5kZWZlcnJlZChjLCEwKTtyZXR1cm4gY307dmFyIEY9e2VxdWFsaXR5Q29tcGFyZXI6Syx2OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXNbSV19LHhhOmZ1bmN0aW9uKCl7dGhpcy5ub3RpZnlTdWJzY3JpYmVycyh0aGlzW0ldLFwic3BlY3RhdGVcIik7dGhpcy5ub3RpZnlTdWJzY3JpYmVycyh0aGlzW0ldKX0seWE6ZnVuY3Rpb24oKXt0aGlzLm5vdGlmeVN1YnNjcmliZXJzKHRoaXNbSV0sXCJiZWZvcmVDaGFuZ2VcIil9fTthLmEuQmEmJmEuYS5zZXRQcm90b3R5cGVPZihGLGEuVC5mbik7dmFyIEc9YS50YS5NYT1cIl9fa29fcHJvdG9fX1wiO0ZbR109YS50YTthLk89ZnVuY3Rpb24oYil7aWYoKGI9XCJmdW5jdGlvblwiPT10eXBlb2YgYiYmYltHXSkmJmIhPT1GW0ddJiZiIT09YS5vLmZuW0ddKXRocm93IEVycm9yKFwiSW52YWxpZCBvYmplY3QgdGhhdCBsb29rcyBsaWtlIGFuIG9ic2VydmFibGU7IHBvc3NpYmx5IGZyb20gYW5vdGhlciBLbm9ja291dCBpbnN0YW5jZVwiKTtcbnJldHVybiEhYn07YS5aYT1mdW5jdGlvbihiKXtyZXR1cm5cImZ1bmN0aW9uXCI9PXR5cGVvZiBiJiYoYltHXT09PUZbR118fGJbR109PT1hLm8uZm5bR10mJmIuTmMpfTthLmIoXCJvYnNlcnZhYmxlXCIsYS50YSk7YS5iKFwiaXNPYnNlcnZhYmxlXCIsYS5PKTthLmIoXCJpc1dyaXRlYWJsZU9ic2VydmFibGVcIixhLlphKTthLmIoXCJpc1dyaXRhYmxlT2JzZXJ2YWJsZVwiLGEuWmEpO2EuYihcIm9ic2VydmFibGUuZm5cIixGKTthLkwoRixcInBlZWtcIixGLnYpO2EuTChGLFwidmFsdWVIYXNNdXRhdGVkXCIsRi54YSk7YS5MKEYsXCJ2YWx1ZVdpbGxNdXRhdGVcIixGLnlhKTthLkhhPWZ1bmN0aW9uKGIpe2I9Ynx8W107aWYoXCJvYmplY3RcIiE9dHlwZW9mIGJ8fCEoXCJsZW5ndGhcImluIGIpKXRocm93IEVycm9yKFwiVGhlIGFyZ3VtZW50IHBhc3NlZCB3aGVuIGluaXRpYWxpemluZyBhbiBvYnNlcnZhYmxlIGFycmF5IG11c3QgYmUgYW4gYXJyYXksIG9yIG51bGwsIG9yIHVuZGVmaW5lZC5cIik7Yj1hLnRhKGIpO2EuYS5BYihiLFxuYS5IYS5mbik7cmV0dXJuIGIuZXh0ZW5kKHt0cmFja0FycmF5Q2hhbmdlczohMH0pfTthLkhhLmZuPXtyZW1vdmU6ZnVuY3Rpb24oYil7Zm9yKHZhciBjPXRoaXMudigpLGQ9W10sZT1cImZ1bmN0aW9uXCIhPXR5cGVvZiBifHxhLk8oYik/ZnVuY3Rpb24oYSl7cmV0dXJuIGE9PT1ifTpiLGY9MDtmPGMubGVuZ3RoO2YrKyl7dmFyIGc9Y1tmXTtpZihlKGcpKXswPT09ZC5sZW5ndGgmJnRoaXMueWEoKTtpZihjW2ZdIT09Zyl0aHJvdyBFcnJvcihcIkFycmF5IG1vZGlmaWVkIGR1cmluZyByZW1vdmU7IGNhbm5vdCByZW1vdmUgaXRlbVwiKTtkLnB1c2goZyk7Yy5zcGxpY2UoZiwxKTtmLS19fWQubGVuZ3RoJiZ0aGlzLnhhKCk7cmV0dXJuIGR9LHJlbW92ZUFsbDpmdW5jdGlvbihiKXtpZihiPT09bil7dmFyIGM9dGhpcy52KCksZD1jLnNsaWNlKDApO3RoaXMueWEoKTtjLnNwbGljZSgwLGMubGVuZ3RoKTt0aGlzLnhhKCk7cmV0dXJuIGR9cmV0dXJuIGI/dGhpcy5yZW1vdmUoZnVuY3Rpb24oYyl7cmV0dXJuIDA8PVxuYS5hLkEoYixjKX0pOltdfSxkZXN0cm95OmZ1bmN0aW9uKGIpe3ZhciBjPXRoaXMudigpLGQ9XCJmdW5jdGlvblwiIT10eXBlb2YgYnx8YS5PKGIpP2Z1bmN0aW9uKGEpe3JldHVybiBhPT09Yn06Yjt0aGlzLnlhKCk7Zm9yKHZhciBlPWMubGVuZ3RoLTE7MDw9ZTtlLS0pe3ZhciBmPWNbZV07ZChmKSYmKGYuX2Rlc3Ryb3k9ITApfXRoaXMueGEoKX0sZGVzdHJveUFsbDpmdW5jdGlvbihiKXtyZXR1cm4gYj09PW4/dGhpcy5kZXN0cm95KGZ1bmN0aW9uKCl7cmV0dXJuITB9KTpiP3RoaXMuZGVzdHJveShmdW5jdGlvbihjKXtyZXR1cm4gMDw9YS5hLkEoYixjKX0pOltdfSxpbmRleE9mOmZ1bmN0aW9uKGIpe3ZhciBjPXRoaXMoKTtyZXR1cm4gYS5hLkEoYyxiKX0scmVwbGFjZTpmdW5jdGlvbihhLGMpe3ZhciBkPXRoaXMuaW5kZXhPZihhKTswPD1kJiYodGhpcy55YSgpLHRoaXMudigpW2RdPWMsdGhpcy54YSgpKX0sc29ydGVkOmZ1bmN0aW9uKGEpe3ZhciBjPXRoaXMoKS5zbGljZSgwKTtcbnJldHVybiBhP2Muc29ydChhKTpjLnNvcnQoKX0scmV2ZXJzZWQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcygpLnNsaWNlKDApLnJldmVyc2UoKX19O2EuYS5CYSYmYS5hLnNldFByb3RvdHlwZU9mKGEuSGEuZm4sYS50YS5mbik7YS5hLkQoXCJwb3AgcHVzaCByZXZlcnNlIHNoaWZ0IHNvcnQgc3BsaWNlIHVuc2hpZnRcIi5zcGxpdChcIiBcIiksZnVuY3Rpb24oYil7YS5IYS5mbltiXT1mdW5jdGlvbigpe3ZhciBhPXRoaXMudigpO3RoaXMueWEoKTt0aGlzLnpjKGEsYixhcmd1bWVudHMpO3ZhciBkPWFbYl0uYXBwbHkoYSxhcmd1bWVudHMpO3RoaXMueGEoKTtyZXR1cm4gZD09PWE/dGhpczpkfX0pO2EuYS5EKFtcInNsaWNlXCJdLGZ1bmN0aW9uKGIpe2EuSGEuZm5bYl09ZnVuY3Rpb24oKXt2YXIgYT10aGlzKCk7cmV0dXJuIGFbYl0uYXBwbHkoYSxhcmd1bWVudHMpfX0pO2EuUGM9ZnVuY3Rpb24oYil7cmV0dXJuIGEuTyhiKSYmXCJmdW5jdGlvblwiPT10eXBlb2YgYi5yZW1vdmUmJlwiZnVuY3Rpb25cIj09XG50eXBlb2YgYi5wdXNofTthLmIoXCJvYnNlcnZhYmxlQXJyYXlcIixhLkhhKTthLmIoXCJpc09ic2VydmFibGVBcnJheVwiLGEuUGMpO2EuVGEudHJhY2tBcnJheUNoYW5nZXM9ZnVuY3Rpb24oYixjKXtmdW5jdGlvbiBkKCl7ZnVuY3Rpb24gYygpe2lmKG0pe3ZhciBkPVtdLmNvbmNhdChiLnYoKXx8W10pLGU7aWYoYi5XYShcImFycmF5Q2hhbmdlXCIpKXtpZighZnx8MTxtKWY9YS5hLlBiKGssZCxiLk9iKTtlPWZ9az1kO2Y9bnVsbDttPTA7ZSYmZS5sZW5ndGgmJmIubm90aWZ5U3Vic2NyaWJlcnMoZSxcImFycmF5Q2hhbmdlXCIpfX1lP2MoKTooZT0hMCxoPWIuc3Vic2NyaWJlKGZ1bmN0aW9uKCl7KyttfSxudWxsLFwic3BlY3RhdGVcIiksaz1bXS5jb25jYXQoYi52KCl8fFtdKSxmPW51bGwsZz1iLnN1YnNjcmliZShjKSl9Yi5PYj17fTtjJiZcIm9iamVjdFwiPT10eXBlb2YgYyYmYS5hLmV4dGVuZChiLk9iLGMpO2IuT2Iuc3BhcnNlPSEwO2lmKCFiLnpjKXt2YXIgZT0hMSxmPW51bGwsZyxoLG09MCxcbmssbD1iLlFhLHA9Yi5oYjtiLlFhPWZ1bmN0aW9uKGEpe2wmJmwuY2FsbChiLGEpO1wiYXJyYXlDaGFuZ2VcIj09PWEmJmQoKX07Yi5oYj1mdW5jdGlvbihhKXtwJiZwLmNhbGwoYixhKTtcImFycmF5Q2hhbmdlXCIhPT1hfHxiLldhKFwiYXJyYXlDaGFuZ2VcIil8fChnJiZnLnMoKSxoJiZoLnMoKSxoPWc9bnVsbCxlPSExLGs9bil9O2IuemM9ZnVuY3Rpb24oYixjLGQpe2Z1bmN0aW9uIGwoYSxiLGMpe3JldHVybiBrW2subGVuZ3RoXT17c3RhdHVzOmEsdmFsdWU6YixpbmRleDpjfX1pZihlJiYhbSl7dmFyIGs9W10scD1iLmxlbmd0aCxnPWQubGVuZ3RoLGg9MDtzd2l0Y2goYyl7Y2FzZSBcInB1c2hcIjpoPXA7Y2FzZSBcInVuc2hpZnRcIjpmb3IoYz0wO2M8ZztjKyspbChcImFkZGVkXCIsZFtjXSxoK2MpO2JyZWFrO2Nhc2UgXCJwb3BcIjpoPXAtMTtjYXNlIFwic2hpZnRcIjpwJiZsKFwiZGVsZXRlZFwiLGJbaF0saCk7YnJlYWs7Y2FzZSBcInNwbGljZVwiOmM9TWF0aC5taW4oTWF0aC5tYXgoMCwwPmRbMF0/cCtkWzBdOlxuZFswXSkscCk7Zm9yKHZhciBwPTE9PT1nP3A6TWF0aC5taW4oYysoZFsxXXx8MCkscCksZz1jK2ctMixoPU1hdGgubWF4KHAsZyksVT1bXSxMPVtdLG49MjtjPGg7KytjLCsrbiljPHAmJkwucHVzaChsKFwiZGVsZXRlZFwiLGJbY10sYykpLGM8ZyYmVS5wdXNoKGwoXCJhZGRlZFwiLGRbbl0sYykpO2EuYS5LYyhMLFUpO2JyZWFrO2RlZmF1bHQ6cmV0dXJufWY9a319fX07dmFyIHI9YS5hLkRhKFwiX3N0YXRlXCIpO2Eubz1hLiQ9ZnVuY3Rpb24oYixjLGQpe2Z1bmN0aW9uIGUoKXtpZigwPGFyZ3VtZW50cy5sZW5ndGgpe2lmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBmKWYuYXBwbHkoZy5uYixhcmd1bWVudHMpO2Vsc2UgdGhyb3cgRXJyb3IoXCJDYW5ub3Qgd3JpdGUgYSB2YWx1ZSB0byBhIGtvLmNvbXB1dGVkIHVubGVzcyB5b3Ugc3BlY2lmeSBhICd3cml0ZScgb3B0aW9uLiBJZiB5b3Ugd2lzaCB0byByZWFkIHRoZSBjdXJyZW50IHZhbHVlLCBkb24ndCBwYXNzIGFueSBwYXJhbWV0ZXJzLlwiKTtyZXR1cm4gdGhpc31nLnJhfHxcbmEudS5jYyhlKTsoZy5rYXx8Zy5KJiZlLlhhKCkpJiZlLmhhKCk7cmV0dXJuIGcuWH1cIm9iamVjdFwiPT09dHlwZW9mIGI/ZD1iOihkPWR8fHt9LGImJihkLnJlYWQ9YikpO2lmKFwiZnVuY3Rpb25cIiE9dHlwZW9mIGQucmVhZCl0aHJvdyBFcnJvcihcIlBhc3MgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBrby5jb21wdXRlZFwiKTt2YXIgZj1kLndyaXRlLGc9e1g6bixzYTohMCxrYTohMCxyYjohMSxqYzohMSxyYTohMSx3YjohMSxKOiExLFdjOmQucmVhZCxuYjpjfHxkLm93bmVyLGw6ZC5kaXNwb3NlV2hlbk5vZGVJc1JlbW92ZWR8fGQubHx8bnVsbCxTYTpkLmRpc3Bvc2VXaGVufHxkLlNhLFJiOm51bGwsSTp7fSxWOjAsSWM6bnVsbH07ZVtyXT1nO2UuTmM9XCJmdW5jdGlvblwiPT09dHlwZW9mIGY7YS5hLkJhfHxhLmEuZXh0ZW5kKGUsYS5ULmZuKTthLlQuZm4ucWIoZSk7YS5hLkFiKGUsQyk7ZC5wdXJlPyhnLndiPSEwLGcuSj0hMCxhLmEuZXh0ZW5kKGUsZGEpKTpcbmQuZGVmZXJFdmFsdWF0aW9uJiZhLmEuZXh0ZW5kKGUsZWEpO2Eub3B0aW9ucy5kZWZlclVwZGF0ZXMmJmEuVGEuZGVmZXJyZWQoZSwhMCk7Zy5sJiYoZy5qYz0hMCxnLmwubm9kZVR5cGV8fChnLmw9bnVsbCkpO2cuSnx8ZC5kZWZlckV2YWx1YXRpb258fGUuaGEoKTtnLmwmJmUuamEoKSYmYS5hLksuemEoZy5sLGcuUmI9ZnVuY3Rpb24oKXtlLnMoKX0pO3JldHVybiBlfTt2YXIgQz17ZXF1YWxpdHlDb21wYXJlcjpLLHFhOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXNbcl0uVn0sVmE6ZnVuY3Rpb24oKXt2YXIgYj1bXTthLmEuUCh0aGlzW3JdLkksZnVuY3Rpb24oYSxkKXtiW2QuS2FdPWQuZGF9KTtyZXR1cm4gYn0sVmI6ZnVuY3Rpb24oYil7aWYoIXRoaXNbcl0uVilyZXR1cm4hMTt2YXIgYz10aGlzLlZhKCk7cmV0dXJuLTEhPT1hLmEuQShjLGIpPyEwOiEhYS5hLkxiKGMsZnVuY3Rpb24oYSl7cmV0dXJuIGEuVmImJmEuVmIoYil9KX0sdWM6ZnVuY3Rpb24oYSxjLGQpe2lmKHRoaXNbcl0ud2ImJlxuYz09PXRoaXMpdGhyb3cgRXJyb3IoXCJBICdwdXJlJyBjb21wdXRlZCBtdXN0IG5vdCBiZSBjYWxsZWQgcmVjdXJzaXZlbHlcIik7dGhpc1tyXS5JW2FdPWQ7ZC5LYT10aGlzW3JdLlYrKztkLkxhPWMub2IoKX0sWGE6ZnVuY3Rpb24oKXt2YXIgYSxjLGQ9dGhpc1tyXS5JO2ZvcihhIGluIGQpaWYoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGQsYSkmJihjPWRbYV0sdGhpcy5JYSYmYy5kYS5KYXx8Yy5kYS5EZChjLkxhKSkpcmV0dXJuITB9LEpkOmZ1bmN0aW9uKCl7dGhpcy5JYSYmIXRoaXNbcl0ucmImJnRoaXMuSWEoITEpfSxqYTpmdW5jdGlvbigpe3ZhciBhPXRoaXNbcl07cmV0dXJuIGEua2F8fDA8YS5WfSxSZDpmdW5jdGlvbigpe3RoaXMuSmE/dGhpc1tyXS5rYSYmKHRoaXNbcl0uc2E9ITApOnRoaXMuSGMoKX0sJGM6ZnVuY3Rpb24oYSl7aWYoYS5IYil7dmFyIGM9YS5zdWJzY3JpYmUodGhpcy5KZCx0aGlzLFwiZGlydHlcIiksZD1hLnN1YnNjcmliZSh0aGlzLlJkLFxudGhpcyk7cmV0dXJue2RhOmEsczpmdW5jdGlvbigpe2MucygpO2QucygpfX19cmV0dXJuIGEuc3Vic2NyaWJlKHRoaXMuSGMsdGhpcyl9LEhjOmZ1bmN0aW9uKCl7dmFyIGI9dGhpcyxjPWIudGhyb3R0bGVFdmFsdWF0aW9uO2MmJjA8PWM/KGNsZWFyVGltZW91dCh0aGlzW3JdLkljKSx0aGlzW3JdLkljPWEuYS5zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7Yi5oYSghMCl9LGMpKTpiLklhP2IuSWEoITApOmIuaGEoITApfSxoYTpmdW5jdGlvbihiKXt2YXIgYz10aGlzW3JdLGQ9Yy5TYSxlPSExO2lmKCFjLnJiJiYhYy5yYSl7aWYoYy5sJiYhYS5hLlNiKGMubCl8fGQmJmQoKSl7aWYoIWMuamMpe3RoaXMucygpO3JldHVybn19ZWxzZSBjLmpjPSExO2MucmI9ITA7dHJ5e2U9dGhpcy56ZChiKX1maW5hbGx5e2MucmI9ITF9cmV0dXJuIGV9fSx6ZDpmdW5jdGlvbihiKXt2YXIgYz10aGlzW3JdLGQ9ITEsZT1jLndiP246IWMuVixkPXtxZDp0aGlzLG1iOmMuSSxRYjpjLlZ9O2EudS54Yyh7cGQ6ZCxcbm9kOmJhLG86dGhpcyxZYTplfSk7Yy5JPXt9O2MuVj0wO3ZhciBmPXRoaXMueWQoYyxkKTtjLlY/ZD10aGlzLnNiKGMuWCxmKToodGhpcy5zKCksZD0hMCk7ZCYmKGMuSj90aGlzLkdiKCk6dGhpcy5ub3RpZnlTdWJzY3JpYmVycyhjLlgsXCJiZWZvcmVDaGFuZ2VcIiksYy5YPWYsdGhpcy5ub3RpZnlTdWJzY3JpYmVycyhjLlgsXCJzcGVjdGF0ZVwiKSwhYy5KJiZiJiZ0aGlzLm5vdGlmeVN1YnNjcmliZXJzKGMuWCksdGhpcy5yYyYmdGhpcy5yYygpKTtlJiZ0aGlzLm5vdGlmeVN1YnNjcmliZXJzKGMuWCxcImF3YWtlXCIpO3JldHVybiBkfSx5ZDpmdW5jdGlvbihiLGMpe3RyeXt2YXIgZD1iLldjO3JldHVybiBiLm5iP2QuY2FsbChiLm5iKTpkKCl9ZmluYWxseXthLnUuZW5kKCksYy5RYiYmIWIuSiYmYS5hLlAoYy5tYixhYSksYi5zYT1iLmthPSExfX0sdjpmdW5jdGlvbihhKXt2YXIgYz10aGlzW3JdOyhjLmthJiYoYXx8IWMuVil8fGMuSiYmdGhpcy5YYSgpKSYmdGhpcy5oYSgpO3JldHVybiBjLlh9LFxudWI6ZnVuY3Rpb24oYil7YS5ULmZuLnViLmNhbGwodGhpcyxiKTt0aGlzLm5jPWZ1bmN0aW9uKCl7dGhpc1tyXS5KfHwodGhpc1tyXS5zYT90aGlzLmhhKCk6dGhpc1tyXS5rYT0hMSk7cmV0dXJuIHRoaXNbcl0uWH07dGhpcy5JYT1mdW5jdGlvbihhKXt0aGlzLnBjKHRoaXNbcl0uWCk7dGhpc1tyXS5rYT0hMDthJiYodGhpc1tyXS5zYT0hMCk7dGhpcy5xYyh0aGlzLCFhKX19LHM6ZnVuY3Rpb24oKXt2YXIgYj10aGlzW3JdOyFiLkomJmIuSSYmYS5hLlAoYi5JLGZ1bmN0aW9uKGEsYil7Yi5zJiZiLnMoKX0pO2IubCYmYi5SYiYmYS5hLksueWIoYi5sLGIuUmIpO2IuST1uO2IuVj0wO2IucmE9ITA7Yi5zYT0hMTtiLmthPSExO2IuSj0hMTtiLmw9bjtiLlNhPW47Yi5XYz1uO3RoaXMuTmN8fChiLm5iPW4pfX0sZGE9e1FhOmZ1bmN0aW9uKGIpe3ZhciBjPXRoaXMsZD1jW3JdO2lmKCFkLnJhJiZkLkomJlwiY2hhbmdlXCI9PWIpe2QuSj0hMTtpZihkLnNhfHxjLlhhKCkpZC5JPW51bGwsZC5WPVxuMCxjLmhhKCkmJmMuR2IoKTtlbHNle3ZhciBlPVtdO2EuYS5QKGQuSSxmdW5jdGlvbihhLGIpe2VbYi5LYV09YX0pO2EuYS5EKGUsZnVuY3Rpb24oYSxiKXt2YXIgZT1kLklbYV0sbT1jLiRjKGUuZGEpO20uS2E9YjttLkxhPWUuTGE7ZC5JW2FdPW19KTtjLlhhKCkmJmMuaGEoKSYmYy5HYigpfWQucmF8fGMubm90aWZ5U3Vic2NyaWJlcnMoZC5YLFwiYXdha2VcIil9fSxoYjpmdW5jdGlvbihiKXt2YXIgYz10aGlzW3JdO2MucmF8fFwiY2hhbmdlXCIhPWJ8fHRoaXMuV2EoXCJjaGFuZ2VcIil8fChhLmEuUChjLkksZnVuY3Rpb24oYSxiKXtiLnMmJihjLklbYV09e2RhOmIuZGEsS2E6Yi5LYSxMYTpiLkxhfSxiLnMoKSl9KSxjLko9ITAsdGhpcy5ub3RpZnlTdWJzY3JpYmVycyhuLFwiYXNsZWVwXCIpKX0sb2I6ZnVuY3Rpb24oKXt2YXIgYj10aGlzW3JdO2IuSiYmKGIuc2F8fHRoaXMuWGEoKSkmJnRoaXMuaGEoKTtyZXR1cm4gYS5ULmZuLm9iLmNhbGwodGhpcyl9fSxlYT17UWE6ZnVuY3Rpb24oYSl7XCJjaGFuZ2VcIiE9XG5hJiZcImJlZm9yZUNoYW5nZVwiIT1hfHx0aGlzLnYoKX19O2EuYS5CYSYmYS5hLnNldFByb3RvdHlwZU9mKEMsYS5ULmZuKTt2YXIgTj1hLnRhLk1hO0NbTl09YS5vO2EuT2M9ZnVuY3Rpb24oYSl7cmV0dXJuXCJmdW5jdGlvblwiPT10eXBlb2YgYSYmYVtOXT09PUNbTl19O2EuRmQ9ZnVuY3Rpb24oYil7cmV0dXJuIGEuT2MoYikmJmJbcl0mJmJbcl0ud2J9O2EuYihcImNvbXB1dGVkXCIsYS5vKTthLmIoXCJkZXBlbmRlbnRPYnNlcnZhYmxlXCIsYS5vKTthLmIoXCJpc0NvbXB1dGVkXCIsYS5PYyk7YS5iKFwiaXNQdXJlQ29tcHV0ZWRcIixhLkZkKTthLmIoXCJjb21wdXRlZC5mblwiLEMpO2EuTChDLFwicGVla1wiLEMudik7YS5MKEMsXCJkaXNwb3NlXCIsQy5zKTthLkwoQyxcImlzQWN0aXZlXCIsQy5qYSk7YS5MKEMsXCJnZXREZXBlbmRlbmNpZXNDb3VudFwiLEMucWEpO2EuTChDLFwiZ2V0RGVwZW5kZW5jaWVzXCIsQy5WYSk7YS54Yj1mdW5jdGlvbihiLGMpe2lmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBiKXJldHVybiBhLm8oYixcbmMse3B1cmU6ITB9KTtiPWEuYS5leHRlbmQoe30sYik7Yi5wdXJlPSEwO3JldHVybiBhLm8oYixjKX07YS5iKFwicHVyZUNvbXB1dGVkXCIsYS54Yik7KGZ1bmN0aW9uKCl7ZnVuY3Rpb24gYihhLGYsZyl7Zz1nfHxuZXcgZDthPWYoYSk7aWYoXCJvYmplY3RcIiE9dHlwZW9mIGF8fG51bGw9PT1hfHxhPT09bnx8YSBpbnN0YW5jZW9mIFJlZ0V4cHx8YSBpbnN0YW5jZW9mIERhdGV8fGEgaW5zdGFuY2VvZiBTdHJpbmd8fGEgaW5zdGFuY2VvZiBOdW1iZXJ8fGEgaW5zdGFuY2VvZiBCb29sZWFuKXJldHVybiBhO3ZhciBoPWEgaW5zdGFuY2VvZiBBcnJheT9bXTp7fTtnLnNhdmUoYSxoKTtjKGEsZnVuY3Rpb24oYyl7dmFyIGQ9ZihhW2NdKTtzd2l0Y2godHlwZW9mIGQpe2Nhc2UgXCJib29sZWFuXCI6Y2FzZSBcIm51bWJlclwiOmNhc2UgXCJzdHJpbmdcIjpjYXNlIFwiZnVuY3Rpb25cIjpoW2NdPWQ7YnJlYWs7Y2FzZSBcIm9iamVjdFwiOmNhc2UgXCJ1bmRlZmluZWRcIjp2YXIgbD1nLmdldChkKTtoW2NdPWwhPT1cbm4/bDpiKGQsZixnKX19KTtyZXR1cm4gaH1mdW5jdGlvbiBjKGEsYil7aWYoYSBpbnN0YW5jZW9mIEFycmF5KXtmb3IodmFyIGM9MDtjPGEubGVuZ3RoO2MrKyliKGMpO1wiZnVuY3Rpb25cIj09dHlwZW9mIGEudG9KU09OJiZiKFwidG9KU09OXCIpfWVsc2UgZm9yKGMgaW4gYSliKGMpfWZ1bmN0aW9uIGQoKXt0aGlzLmtleXM9W107dGhpcy52YWx1ZXM9W119YS5hZD1mdW5jdGlvbihjKXtpZigwPT1hcmd1bWVudHMubGVuZ3RoKXRocm93IEVycm9yKFwiV2hlbiBjYWxsaW5nIGtvLnRvSlMsIHBhc3MgdGhlIG9iamVjdCB5b3Ugd2FudCB0byBjb252ZXJ0LlwiKTtyZXR1cm4gYihjLGZ1bmN0aW9uKGIpe2Zvcih2YXIgYz0wO2EuTyhiKSYmMTA+YztjKyspYj1iKCk7cmV0dXJuIGJ9KX07YS50b0pTT049ZnVuY3Rpb24oYixjLGQpe2I9YS5hZChiKTtyZXR1cm4gYS5hLmhjKGIsYyxkKX07ZC5wcm90b3R5cGU9e2NvbnN0cnVjdG9yOmQsc2F2ZTpmdW5jdGlvbihiLGMpe3ZhciBkPWEuYS5BKHRoaXMua2V5cyxcbmIpOzA8PWQ/dGhpcy52YWx1ZXNbZF09YzoodGhpcy5rZXlzLnB1c2goYiksdGhpcy52YWx1ZXMucHVzaChjKSl9LGdldDpmdW5jdGlvbihiKXtiPWEuYS5BKHRoaXMua2V5cyxiKTtyZXR1cm4gMDw9Yj90aGlzLnZhbHVlc1tiXTpufX19KSgpO2EuYihcInRvSlNcIixhLmFkKTthLmIoXCJ0b0pTT05cIixhLnRvSlNPTik7YS5XZD1mdW5jdGlvbihiLGMsZCl7ZnVuY3Rpb24gZShjKXt2YXIgZT1hLnhiKGIsZCkuZXh0ZW5kKHttYTpcImFsd2F5c1wifSksaD1lLnN1YnNjcmliZShmdW5jdGlvbihhKXthJiYoaC5zKCksYyhhKSl9KTtlLm5vdGlmeVN1YnNjcmliZXJzKGUudigpKTtyZXR1cm4gaH1yZXR1cm5cImZ1bmN0aW9uXCIhPT10eXBlb2YgUHJvbWlzZXx8Yz9lKGMuYmluZChkKSk6bmV3IFByb21pc2UoZSl9O2EuYihcIndoZW5cIixhLldkKTsoZnVuY3Rpb24oKXthLnc9e006ZnVuY3Rpb24oYil7c3dpdGNoKGEuYS5SKGIpKXtjYXNlIFwib3B0aW9uXCI6cmV0dXJuITA9PT1iLl9fa29fX2hhc0RvbURhdGFPcHRpb25WYWx1ZV9fP1xuYS5hLmcuZ2V0KGIsYS5jLm9wdGlvbnMuJGIpOjc+PWEuYS5XP2IuZ2V0QXR0cmlidXRlTm9kZShcInZhbHVlXCIpJiZiLmdldEF0dHJpYnV0ZU5vZGUoXCJ2YWx1ZVwiKS5zcGVjaWZpZWQ/Yi52YWx1ZTpiLnRleHQ6Yi52YWx1ZTtjYXNlIFwic2VsZWN0XCI6cmV0dXJuIDA8PWIuc2VsZWN0ZWRJbmRleD9hLncuTShiLm9wdGlvbnNbYi5zZWxlY3RlZEluZGV4XSk6bjtkZWZhdWx0OnJldHVybiBiLnZhbHVlfX0sY2I6ZnVuY3Rpb24oYixjLGQpe3N3aXRjaChhLmEuUihiKSl7Y2FzZSBcIm9wdGlvblwiOlwic3RyaW5nXCI9PT10eXBlb2YgYz8oYS5hLmcuc2V0KGIsYS5jLm9wdGlvbnMuJGIsbiksXCJfX2tvX19oYXNEb21EYXRhT3B0aW9uVmFsdWVfX1wiaW4gYiYmZGVsZXRlIGIuX19rb19faGFzRG9tRGF0YU9wdGlvblZhbHVlX18sYi52YWx1ZT1jKTooYS5hLmcuc2V0KGIsYS5jLm9wdGlvbnMuJGIsYyksYi5fX2tvX19oYXNEb21EYXRhT3B0aW9uVmFsdWVfXz0hMCxiLnZhbHVlPVwibnVtYmVyXCI9PT1cbnR5cGVvZiBjP2M6XCJcIik7YnJlYWs7Y2FzZSBcInNlbGVjdFwiOmlmKFwiXCI9PT1jfHxudWxsPT09YyljPW47Zm9yKHZhciBlPS0xLGY9MCxnPWIub3B0aW9ucy5sZW5ndGgsaDtmPGc7KytmKWlmKGg9YS53Lk0oYi5vcHRpb25zW2ZdKSxoPT1jfHxcIlwiPT09aCYmYz09PW4pe2U9ZjticmVha31pZihkfHwwPD1lfHxjPT09biYmMTxiLnNpemUpYi5zZWxlY3RlZEluZGV4PWUsNj09PWEuYS5XJiZhLmEuc2V0VGltZW91dChmdW5jdGlvbigpe2Iuc2VsZWN0ZWRJbmRleD1lfSwwKTticmVhaztkZWZhdWx0OmlmKG51bGw9PT1jfHxjPT09biljPVwiXCI7Yi52YWx1ZT1jfX19fSkoKTthLmIoXCJzZWxlY3RFeHRlbnNpb25zXCIsYS53KTthLmIoXCJzZWxlY3RFeHRlbnNpb25zLnJlYWRWYWx1ZVwiLGEudy5NKTthLmIoXCJzZWxlY3RFeHRlbnNpb25zLndyaXRlVmFsdWVcIixhLncuY2IpO2EubT1mdW5jdGlvbigpe2Z1bmN0aW9uIGIoYil7Yj1hLmEuRGIoYik7MTIzPT09Yi5jaGFyQ29kZUF0KDApJiYoYj1iLnNsaWNlKDEsXG4tMSkpO2IrPVwiXFxuLFwiO3ZhciBjPVtdLGQ9Yi5tYXRjaChlKSxwLHE9W10saD0wO2lmKDE8ZC5sZW5ndGgpe2Zvcih2YXIgeD0wLEI7Qj1kW3hdOysreCl7dmFyIHU9Qi5jaGFyQ29kZUF0KDApO2lmKDQ0PT09dSl7aWYoMD49aCl7Yy5wdXNoKHAmJnEubGVuZ3RoP3trZXk6cCx2YWx1ZTpxLmpvaW4oXCJcIil9Ont1bmtub3duOnB8fHEuam9pbihcIlwiKX0pO3A9aD0wO3E9W107Y29udGludWV9fWVsc2UgaWYoNTg9PT11KXtpZighaCYmIXAmJjE9PT1xLmxlbmd0aCl7cD1xLnBvcCgpO2NvbnRpbnVlfX1lbHNlIGlmKDQ3PT09dSYmMTxCLmxlbmd0aCYmKDQ3PT09Qi5jaGFyQ29kZUF0KDEpfHw0Mj09PUIuY2hhckNvZGVBdCgxKSkpY29udGludWU7ZWxzZSA0Nz09PXUmJngmJjE8Qi5sZW5ndGg/KHU9ZFt4LTFdLm1hdGNoKGYpKSYmIWdbdVswXV0mJihiPWIuc3Vic3RyKGIuaW5kZXhPZihCKSsxKSxkPWIubWF0Y2goZSkseD0tMSxCPVwiL1wiKTo0MD09PXV8fDEyMz09PXV8fDkxPT09dT8rK2g6XG40MT09PXV8fDEyNT09PXV8fDkzPT09dT8tLWg6cHx8cS5sZW5ndGh8fDM0IT09dSYmMzkhPT11fHwoQj1CLnNsaWNlKDEsLTEpKTtxLnB1c2goQil9aWYoMDxoKXRocm93IEVycm9yKFwiVW5iYWxhbmNlZCBwYXJlbnRoZXNlcywgYnJhY2VzLCBvciBicmFja2V0c1wiKTt9cmV0dXJuIGN9dmFyIGM9W1widHJ1ZVwiLFwiZmFsc2VcIixcIm51bGxcIixcInVuZGVmaW5lZFwiXSxkPS9eKD86WyRfYS16XVskXFx3XSp8KC4rKShcXC5cXHMqWyRfYS16XVskXFx3XSp8XFxbLitcXF0pKSQvaSxlPVJlZ0V4cChcIlxcXCIoPzpcXFxcXFxcXC58W15cXFwiXSkqXFxcInwnKD86XFxcXFxcXFwufFteJ10pKid8YCg/OlxcXFxcXFxcLnxbXmBdKSpgfC9cXFxcKig/OlteKl18XFxcXCorW14qL10pKlxcXFwqKy98Ly8uKlxcbnwvKD86XFxcXFxcXFwufFteL10pKy93KnxbXlxcXFxzOiwvXVteLFxcXCInYHt9KCkvOltcXFxcXV0qW15cXFxccyxcXFwiJ2B7fSgpLzpbXFxcXF1dfFteXFxcXHNdXCIsXCJnXCIpLGY9L1tcXF0pXCInQS1aYS16MC05XyRdKyQvLGc9e1wiaW5cIjoxLFwicmV0dXJuXCI6MSxcInR5cGVvZlwiOjF9LFxuaD17fTtyZXR1cm57UmE6W10sd2E6aCxhYzpiLHZiOmZ1bmN0aW9uKGUsZil7ZnVuY3Rpb24gbChiLGUpe3ZhciBmO2lmKCF4KXt2YXIgaz1hLmdldEJpbmRpbmdIYW5kbGVyKGIpO2lmKGsmJmsucHJlcHJvY2VzcyYmIShlPWsucHJlcHJvY2VzcyhlLGIsbCkpKXJldHVybjtpZihrPWhbYl0pZj1lLDA8PWEuYS5BKGMsZik/Zj0hMTooaz1mLm1hdGNoKGQpLGY9bnVsbD09PWs/ITE6a1sxXT9cIk9iamVjdChcIitrWzFdK1wiKVwiK2tbMl06Ziksaz1mO2smJnEucHVzaChcIidcIisoXCJzdHJpbmdcIj09dHlwZW9mIGhbYl0/aFtiXTpiKStcIic6ZnVuY3Rpb24oX3ope1wiK2YrXCI9X3p9XCIpfWcmJihlPVwiZnVuY3Rpb24oKXtyZXR1cm4gXCIrZStcIiB9XCIpO3AucHVzaChcIidcIitiK1wiJzpcIitlKX1mPWZ8fHt9O3ZhciBwPVtdLHE9W10sZz1mLnZhbHVlQWNjZXNzb3JzLHg9Zi5iaW5kaW5nUGFyYW1zLEI9XCJzdHJpbmdcIj09PXR5cGVvZiBlP2IoZSk6ZTthLmEuRChCLGZ1bmN0aW9uKGEpe2woYS5rZXl8fGEudW5rbm93bixcbmEudmFsdWUpfSk7cS5sZW5ndGgmJmwoXCJfa29fcHJvcGVydHlfd3JpdGVyc1wiLFwie1wiK3Euam9pbihcIixcIikrXCIgfVwiKTtyZXR1cm4gcC5qb2luKFwiLFwiKX0sSWQ6ZnVuY3Rpb24oYSxiKXtmb3IodmFyIGM9MDtjPGEubGVuZ3RoO2MrKylpZihhW2NdLmtleT09YilyZXR1cm4hMDtyZXR1cm4hMX0sZWI6ZnVuY3Rpb24oYixjLGQsZSxmKXtpZihiJiZhLk8oYikpIWEuWmEoYil8fGYmJmIudigpPT09ZXx8YihlKTtlbHNlIGlmKChiPWMuZ2V0KFwiX2tvX3Byb3BlcnR5X3dyaXRlcnNcIikpJiZiW2RdKWJbZF0oZSl9fX0oKTthLmIoXCJleHByZXNzaW9uUmV3cml0aW5nXCIsYS5tKTthLmIoXCJleHByZXNzaW9uUmV3cml0aW5nLmJpbmRpbmdSZXdyaXRlVmFsaWRhdG9yc1wiLGEubS5SYSk7YS5iKFwiZXhwcmVzc2lvblJld3JpdGluZy5wYXJzZU9iamVjdExpdGVyYWxcIixhLm0uYWMpO2EuYihcImV4cHJlc3Npb25SZXdyaXRpbmcucHJlUHJvY2Vzc0JpbmRpbmdzXCIsYS5tLnZiKTthLmIoXCJleHByZXNzaW9uUmV3cml0aW5nLl90d29XYXlCaW5kaW5nc1wiLFxuYS5tLndhKTthLmIoXCJqc29uRXhwcmVzc2lvblJld3JpdGluZ1wiLGEubSk7YS5iKFwianNvbkV4cHJlc3Npb25SZXdyaXRpbmcuaW5zZXJ0UHJvcGVydHlBY2Nlc3NvcnNJbnRvSnNvblwiLGEubS52Yik7KGZ1bmN0aW9uKCl7ZnVuY3Rpb24gYihhKXtyZXR1cm4gOD09YS5ub2RlVHlwZSYmZy50ZXN0KGY/YS50ZXh0OmEubm9kZVZhbHVlKX1mdW5jdGlvbiBjKGEpe3JldHVybiA4PT1hLm5vZGVUeXBlJiZoLnRlc3QoZj9hLnRleHQ6YS5ub2RlVmFsdWUpfWZ1bmN0aW9uIGQoZCxlKXtmb3IodmFyIGY9ZCxoPTEsZz1bXTtmPWYubmV4dFNpYmxpbmc7KXtpZihjKGYpJiYoYS5hLmcuc2V0KGYsaywhMCksaC0tLDA9PT1oKSlyZXR1cm4gZztnLnB1c2goZik7YihmKSYmaCsrfWlmKCFlKXRocm93IEVycm9yKFwiQ2Fubm90IGZpbmQgY2xvc2luZyBjb21tZW50IHRhZyB0byBtYXRjaDogXCIrZC5ub2RlVmFsdWUpO3JldHVybiBudWxsfWZ1bmN0aW9uIGUoYSxiKXt2YXIgYz1kKGEsYik7cmV0dXJuIGM/XG4wPGMubGVuZ3RoP2NbYy5sZW5ndGgtMV0ubmV4dFNpYmxpbmc6YS5uZXh0U2libGluZzpudWxsfXZhciBmPXcmJlwiXFx4M2MhLS10ZXN0LS1cXHgzZVwiPT09dy5jcmVhdGVDb21tZW50KFwidGVzdFwiKS50ZXh0LGc9Zj8vXlxceDNjIS0tXFxzKmtvKD86XFxzKyhbXFxzXFxTXSspKT9cXHMqLS1cXHgzZSQvOi9eXFxzKmtvKD86XFxzKyhbXFxzXFxTXSspKT9cXHMqJC8saD1mPy9eXFx4M2MhLS1cXHMqXFwva29cXHMqLS1cXHgzZSQvOi9eXFxzKlxcL2tvXFxzKiQvLG09e3VsOiEwLG9sOiEwfSxrPVwiX19rb19tYXRjaGVkRW5kQ29tbWVudF9fXCI7YS5oPXtlYTp7fSxjaGlsZE5vZGVzOmZ1bmN0aW9uKGEpe3JldHVybiBiKGEpP2QoYSk6YS5jaGlsZE5vZGVzfSxFYTpmdW5jdGlvbihjKXtpZihiKGMpKXtjPWEuaC5jaGlsZE5vZGVzKGMpO2Zvcih2YXIgZD0wLGU9Yy5sZW5ndGg7ZDxlO2QrKylhLnJlbW92ZU5vZGUoY1tkXSl9ZWxzZSBhLmEuVGIoYyl9LHZhOmZ1bmN0aW9uKGMsZCl7aWYoYihjKSl7YS5oLkVhKGMpO2Zvcih2YXIgZT1cbmMubmV4dFNpYmxpbmcsZj0wLGs9ZC5sZW5ndGg7ZjxrO2YrKyllLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGRbZl0sZSl9ZWxzZSBhLmEudmEoYyxkKX0sVmM6ZnVuY3Rpb24oYSxjKXt2YXIgZDtiKGEpPyhkPWEubmV4dFNpYmxpbmcsYT1hLnBhcmVudE5vZGUpOmQ9YS5maXJzdENoaWxkO2Q/YyE9PWQmJmEuaW5zZXJ0QmVmb3JlKGMsZCk6YS5hcHBlbmRDaGlsZChjKX0sV2I6ZnVuY3Rpb24oYyxkLGUpe2U/KGU9ZS5uZXh0U2libGluZyxiKGMpJiYoYz1jLnBhcmVudE5vZGUpLGU/ZCE9PWUmJmMuaW5zZXJ0QmVmb3JlKGQsZSk6Yy5hcHBlbmRDaGlsZChkKSk6YS5oLlZjKGMsZCl9LGZpcnN0Q2hpbGQ6ZnVuY3Rpb24oYSl7aWYoYihhKSlyZXR1cm4hYS5uZXh0U2libGluZ3x8YyhhLm5leHRTaWJsaW5nKT9udWxsOmEubmV4dFNpYmxpbmc7aWYoYS5maXJzdENoaWxkJiZjKGEuZmlyc3RDaGlsZCkpdGhyb3cgRXJyb3IoXCJGb3VuZCBpbnZhbGlkIGVuZCBjb21tZW50LCBhcyB0aGUgZmlyc3QgY2hpbGQgb2YgXCIrXG5hKTtyZXR1cm4gYS5maXJzdENoaWxkfSxuZXh0U2libGluZzpmdW5jdGlvbihkKXtiKGQpJiYoZD1lKGQpKTtpZihkLm5leHRTaWJsaW5nJiZjKGQubmV4dFNpYmxpbmcpKXt2YXIgZj1kLm5leHRTaWJsaW5nO2lmKGMoZikmJiFhLmEuZy5nZXQoZixrKSl0aHJvdyBFcnJvcihcIkZvdW5kIGVuZCBjb21tZW50IHdpdGhvdXQgYSBtYXRjaGluZyBvcGVuaW5nIGNvbW1lbnQsIGFzIGNoaWxkIG9mIFwiK2QpO3JldHVybiBudWxsfXJldHVybiBkLm5leHRTaWJsaW5nfSxDZDpiLFZkOmZ1bmN0aW9uKGEpe3JldHVybihhPShmP2EudGV4dDphLm5vZGVWYWx1ZSkubWF0Y2goZykpP2FbMV06bnVsbH0sU2M6ZnVuY3Rpb24oZCl7aWYobVthLmEuUihkKV0pe3ZhciBmPWQuZmlyc3RDaGlsZDtpZihmKXtkbyBpZigxPT09Zi5ub2RlVHlwZSl7dmFyIGs7az1mLmZpcnN0Q2hpbGQ7dmFyIGg9bnVsbDtpZihrKXtkbyBpZihoKWgucHVzaChrKTtlbHNlIGlmKGIoaykpe3ZhciBnPWUoaywhMCk7Zz9rPVxuZzpoPVtrXX1lbHNlIGMoaykmJihoPVtrXSk7d2hpbGUoaz1rLm5leHRTaWJsaW5nKX1pZihrPWgpZm9yKGg9Zi5uZXh0U2libGluZyxnPTA7ZzxrLmxlbmd0aDtnKyspaD9kLmluc2VydEJlZm9yZShrW2ddLGgpOmQuYXBwZW5kQ2hpbGQoa1tnXSl9d2hpbGUoZj1mLm5leHRTaWJsaW5nKX19fX19KSgpO2EuYihcInZpcnR1YWxFbGVtZW50c1wiLGEuaCk7YS5iKFwidmlydHVhbEVsZW1lbnRzLmFsbG93ZWRCaW5kaW5nc1wiLGEuaC5lYSk7YS5iKFwidmlydHVhbEVsZW1lbnRzLmVtcHR5Tm9kZVwiLGEuaC5FYSk7YS5iKFwidmlydHVhbEVsZW1lbnRzLmluc2VydEFmdGVyXCIsYS5oLldiKTthLmIoXCJ2aXJ0dWFsRWxlbWVudHMucHJlcGVuZFwiLGEuaC5WYyk7YS5iKFwidmlydHVhbEVsZW1lbnRzLnNldERvbU5vZGVDaGlsZHJlblwiLGEuaC52YSk7KGZ1bmN0aW9uKCl7YS5nYT1mdW5jdGlvbigpe3RoaXMubmQ9e319O2EuYS5leHRlbmQoYS5nYS5wcm90b3R5cGUse25vZGVIYXNCaW5kaW5nczpmdW5jdGlvbihiKXtzd2l0Y2goYi5ub2RlVHlwZSl7Y2FzZSAxOnJldHVybiBudWxsIT1cbmIuZ2V0QXR0cmlidXRlKFwiZGF0YS1iaW5kXCIpfHxhLmouZ2V0Q29tcG9uZW50TmFtZUZvck5vZGUoYik7Y2FzZSA4OnJldHVybiBhLmguQ2QoYik7ZGVmYXVsdDpyZXR1cm4hMX19LGdldEJpbmRpbmdzOmZ1bmN0aW9uKGIsYyl7dmFyIGQ9dGhpcy5nZXRCaW5kaW5nc1N0cmluZyhiLGMpLGQ9ZD90aGlzLnBhcnNlQmluZGluZ3NTdHJpbmcoZCxjLGIpOm51bGw7cmV0dXJuIGEuai50YyhkLGIsYywhMSl9LGdldEJpbmRpbmdBY2Nlc3NvcnM6ZnVuY3Rpb24oYixjKXt2YXIgZD10aGlzLmdldEJpbmRpbmdzU3RyaW5nKGIsYyksZD1kP3RoaXMucGFyc2VCaW5kaW5nc1N0cmluZyhkLGMsYix7dmFsdWVBY2Nlc3NvcnM6ITB9KTpudWxsO3JldHVybiBhLmoudGMoZCxiLGMsITApfSxnZXRCaW5kaW5nc1N0cmluZzpmdW5jdGlvbihiKXtzd2l0Y2goYi5ub2RlVHlwZSl7Y2FzZSAxOnJldHVybiBiLmdldEF0dHJpYnV0ZShcImRhdGEtYmluZFwiKTtjYXNlIDg6cmV0dXJuIGEuaC5WZChiKTtkZWZhdWx0OnJldHVybiBudWxsfX0sXG5wYXJzZUJpbmRpbmdzU3RyaW5nOmZ1bmN0aW9uKGIsYyxkLGUpe3RyeXt2YXIgZj10aGlzLm5kLGc9YisoZSYmZS52YWx1ZUFjY2Vzc29yc3x8XCJcIiksaDtpZighKGg9ZltnXSkpe3ZhciBtLGs9XCJ3aXRoKCRjb250ZXh0KXt3aXRoKCRkYXRhfHx7fSl7cmV0dXJue1wiK2EubS52YihiLGUpK1wifX19XCI7bT1uZXcgRnVuY3Rpb24oXCIkY29udGV4dFwiLFwiJGVsZW1lbnRcIixrKTtoPWZbZ109bX1yZXR1cm4gaChjLGQpfWNhdGNoKGwpe3Rocm93IGwubWVzc2FnZT1cIlVuYWJsZSB0byBwYXJzZSBiaW5kaW5ncy5cXG5CaW5kaW5ncyB2YWx1ZTogXCIrYitcIlxcbk1lc3NhZ2U6IFwiK2wubWVzc2FnZSxsO319fSk7YS5nYS5pbnN0YW5jZT1uZXcgYS5nYX0pKCk7YS5iKFwiYmluZGluZ1Byb3ZpZGVyXCIsYS5nYSk7KGZ1bmN0aW9uKCl7ZnVuY3Rpb24gYihiKXt2YXIgYz0oYj1hLmEuZy5nZXQoYix6KSkmJmIuTjtjJiYoYi5OPW51bGwsYy5UYygpKX1mdW5jdGlvbiBjKGMsZCxlKXt0aGlzLm5vZGU9Yzt0aGlzLnljPVxuZDt0aGlzLmtiPVtdO3RoaXMuSD0hMTtkLk58fGEuYS5LLnphKGMsYik7ZSYmZS5OJiYoZS5OLmtiLnB1c2goYyksdGhpcy5LYj1lKX1mdW5jdGlvbiBkKGEpe3JldHVybiBmdW5jdGlvbigpe3JldHVybiBhfX1mdW5jdGlvbiBlKGEpe3JldHVybiBhKCl9ZnVuY3Rpb24gZihiKXtyZXR1cm4gYS5hLkdhKGEudS5HKGIpLGZ1bmN0aW9uKGEsYyl7cmV0dXJuIGZ1bmN0aW9uKCl7cmV0dXJuIGIoKVtjXX19KX1mdW5jdGlvbiBnKGIsYyxlKXtyZXR1cm5cImZ1bmN0aW9uXCI9PT10eXBlb2YgYj9mKGIuYmluZChudWxsLGMsZSkpOmEuYS5HYShiLGQpfWZ1bmN0aW9uIGgoYSxiKXtyZXR1cm4gZih0aGlzLmdldEJpbmRpbmdzLmJpbmQodGhpcyxhLGIpKX1mdW5jdGlvbiBtKGIsYyl7dmFyIGQ9YS5oLmZpcnN0Q2hpbGQoYyk7aWYoZCl7dmFyIGUsZj1hLmdhLmluc3RhbmNlLGw9Zi5wcmVwcm9jZXNzTm9kZTtpZihsKXtmb3IoO2U9ZDspZD1hLmgubmV4dFNpYmxpbmcoZSksbC5jYWxsKGYsZSk7XG5kPWEuaC5maXJzdENoaWxkKGMpfWZvcig7ZT1kOylkPWEuaC5uZXh0U2libGluZyhlKSxrKGIsZSl9YS5pLm1hKGMsYS5pLkgpfWZ1bmN0aW9uIGsoYixjKXt2YXIgZD1iLGU9MT09PWMubm9kZVR5cGU7ZSYmYS5oLlNjKGMpO2lmKGV8fGEuZ2EuaW5zdGFuY2Uubm9kZUhhc0JpbmRpbmdzKGMpKWQ9cChjLG51bGwsYikuYmluZGluZ0NvbnRleHRGb3JEZXNjZW5kYW50cztkJiYhdVthLmEuUihjKV0mJm0oZCxjKX1mdW5jdGlvbiBsKGIpe3ZhciBjPVtdLGQ9e30sZT1bXTthLmEuUChiLGZ1bmN0aW9uIGNhKGYpe2lmKCFkW2ZdKXt2YXIgaz1hLmdldEJpbmRpbmdIYW5kbGVyKGYpO2smJihrLmFmdGVyJiYoZS5wdXNoKGYpLGEuYS5EKGsuYWZ0ZXIsZnVuY3Rpb24oYyl7aWYoYltjXSl7aWYoLTEhPT1hLmEuQShlLGMpKXRocm93IEVycm9yKFwiQ2Fubm90IGNvbWJpbmUgdGhlIGZvbGxvd2luZyBiaW5kaW5ncywgYmVjYXVzZSB0aGV5IGhhdmUgYSBjeWNsaWMgZGVwZW5kZW5jeTogXCIrZS5qb2luKFwiLCBcIikpO1xuY2EoYyl9fSksZS5sZW5ndGgtLSksYy5wdXNoKHtrZXk6ZixNYzprfSkpO2RbZl09ITB9fSk7cmV0dXJuIGN9ZnVuY3Rpb24gcChiLGMsZCl7dmFyIGY9YS5hLmcuVWIoYix6LHt9KSxrPWYuaGQ7aWYoIWMpe2lmKGspdGhyb3cgRXJyb3IoXCJZb3UgY2Fubm90IGFwcGx5IGJpbmRpbmdzIG11bHRpcGxlIHRpbWVzIHRvIHRoZSBzYW1lIGVsZW1lbnQuXCIpO2YuaGQ9ITB9a3x8KGYuY29udGV4dD1kKTtmLlpifHwoZi5aYj17fSk7dmFyIGc7aWYoYyYmXCJmdW5jdGlvblwiIT09dHlwZW9mIGMpZz1jO2Vsc2V7dmFyIHA9YS5nYS5pbnN0YW5jZSxxPXAuZ2V0QmluZGluZ0FjY2Vzc29yc3x8aCxtPWEuJChmdW5jdGlvbigpe2lmKGc9Yz9jKGQsYik6cS5jYWxsKHAsYixkKSl7aWYoZFt0XSlkW3RdKCk7aWYoZFtCXSlkW0JdKCl9cmV0dXJuIGd9LG51bGwse2w6Yn0pO2cmJm0uamEoKXx8KG09bnVsbCl9dmFyIHg9ZCx1O2lmKGcpe3ZhciBKPWZ1bmN0aW9uKCl7cmV0dXJuIGEuYS5HYShtP20oKTpcbmcsZSl9LHI9bT9mdW5jdGlvbihhKXtyZXR1cm4gZnVuY3Rpb24oKXtyZXR1cm4gZShtKClbYV0pfX06ZnVuY3Rpb24oYSl7cmV0dXJuIGdbYV19O0ouZ2V0PWZ1bmN0aW9uKGEpe3JldHVybiBnW2FdJiZlKHIoYSkpfTtKLmhhcz1mdW5jdGlvbihhKXtyZXR1cm4gYSBpbiBnfTthLmkuSCBpbiBnJiZhLmkuc3Vic2NyaWJlKGIsYS5pLkgsZnVuY3Rpb24oKXt2YXIgYz0oMCxnW2EuaS5IXSkoKTtpZihjKXt2YXIgZD1hLmguY2hpbGROb2RlcyhiKTtkLmxlbmd0aCYmYyhkLGEuRWMoZFswXSkpfX0pO2EuaS5wYSBpbiBnJiYoeD1hLmkuQ2IoYixkKSxhLmkuc3Vic2NyaWJlKGIsYS5pLnBhLGZ1bmN0aW9uKCl7dmFyIGM9KDAsZ1thLmkucGFdKSgpO2MmJmEuaC5maXJzdENoaWxkKGIpJiZjKGIpfSkpO2Y9bChnKTthLmEuRChmLGZ1bmN0aW9uKGMpe3ZhciBkPWMuTWMuaW5pdCxlPWMuTWMudXBkYXRlLGY9Yy5rZXk7aWYoOD09PWIubm9kZVR5cGUmJiFhLmguZWFbZl0pdGhyb3cgRXJyb3IoXCJUaGUgYmluZGluZyAnXCIrXG5mK1wiJyBjYW5ub3QgYmUgdXNlZCB3aXRoIHZpcnR1YWwgZWxlbWVudHNcIik7dHJ5e1wiZnVuY3Rpb25cIj09dHlwZW9mIGQmJmEudS5HKGZ1bmN0aW9uKCl7dmFyIGE9ZChiLHIoZiksSix4LiRkYXRhLHgpO2lmKGEmJmEuY29udHJvbHNEZXNjZW5kYW50QmluZGluZ3Mpe2lmKHUhPT1uKXRocm93IEVycm9yKFwiTXVsdGlwbGUgYmluZGluZ3MgKFwiK3UrXCIgYW5kIFwiK2YrXCIpIGFyZSB0cnlpbmcgdG8gY29udHJvbCBkZXNjZW5kYW50IGJpbmRpbmdzIG9mIHRoZSBzYW1lIGVsZW1lbnQuIFlvdSBjYW5ub3QgdXNlIHRoZXNlIGJpbmRpbmdzIHRvZ2V0aGVyIG9uIHRoZSBzYW1lIGVsZW1lbnQuXCIpO3U9Zn19KSxcImZ1bmN0aW9uXCI9PXR5cGVvZiBlJiZhLiQoZnVuY3Rpb24oKXtlKGIscihmKSxKLHguJGRhdGEseCl9LG51bGwse2w6Yn0pfWNhdGNoKGspe3Rocm93IGsubWVzc2FnZT0nVW5hYmxlIHRvIHByb2Nlc3MgYmluZGluZyBcIicrZitcIjogXCIrZ1tmXSsnXCJcXG5NZXNzYWdlOiAnK2subWVzc2FnZSxcbms7fX0pfWY9dT09PW47cmV0dXJue3Nob3VsZEJpbmREZXNjZW5kYW50czpmLGJpbmRpbmdDb250ZXh0Rm9yRGVzY2VuZGFudHM6ZiYmeH19ZnVuY3Rpb24gcShiLGMpe3JldHVybiBiJiZiIGluc3RhbmNlb2YgYS5mYT9iOm5ldyBhLmZhKGIsbixuLGMpfXZhciB0PWEuYS5EYShcIl9zdWJzY3JpYmFibGVcIikseD1hLmEuRGEoXCJfYW5jZXN0b3JCaW5kaW5nSW5mb1wiKSxCPWEuYS5EYShcIl9kYXRhRGVwZW5kZW5jeVwiKTthLmM9e307dmFyIHU9e3NjcmlwdDohMCx0ZXh0YXJlYTohMCx0ZW1wbGF0ZTohMH07YS5nZXRCaW5kaW5nSGFuZGxlcj1mdW5jdGlvbihiKXtyZXR1cm4gYS5jW2JdfTt2YXIgSj17fTthLmZhPWZ1bmN0aW9uKGIsYyxkLGUsZil7ZnVuY3Rpb24gaygpe3ZhciBiPXA/aCgpOmgsZj1hLmEuZihiKTtjPyhhLmEuZXh0ZW5kKGwsYykseCBpbiBjJiYobFt4XT1jW3hdKSk6KGwuJHBhcmVudHM9W10sbC4kcm9vdD1mLGwua289YSk7bFt0XT1xO2c/Zj1sLiRkYXRhOihsLiRyYXdEYXRhPVxuYixsLiRkYXRhPWYpO2QmJihsW2RdPWYpO2UmJmUobCxjLGYpO2lmKGMmJmNbdF0mJiFhLlMubygpLlZiKGNbdF0pKWNbdF0oKTttJiYobFtCXT1tKTtyZXR1cm4gbC4kZGF0YX12YXIgbD10aGlzLGc9Yj09PUosaD1nP246YixwPVwiZnVuY3Rpb25cIj09dHlwZW9mIGgmJiFhLk8oaCkscSxtPWYmJmYuZGF0YURlcGVuZGVuY3k7ZiYmZi5leHBvcnREZXBlbmRlbmNpZXM/aygpOihxPWEueGIoaykscS52KCkscS5qYSgpP3EuZXF1YWxpdHlDb21wYXJlcj1udWxsOmxbdF09bil9O2EuZmEucHJvdG90eXBlLmNyZWF0ZUNoaWxkQ29udGV4dD1mdW5jdGlvbihiLGMsZCxlKXshZSYmYyYmXCJvYmplY3RcIj09dHlwZW9mIGMmJihlPWMsYz1lLmFzLGQ9ZS5leHRlbmQpO2lmKGMmJmUmJmUubm9DaGlsZENvbnRleHQpe3ZhciBmPVwiZnVuY3Rpb25cIj09dHlwZW9mIGImJiFhLk8oYik7cmV0dXJuIG5ldyBhLmZhKEosdGhpcyxudWxsLGZ1bmN0aW9uKGEpe2QmJmQoYSk7YVtjXT1mP2IoKTpifSxlKX1yZXR1cm4gbmV3IGEuZmEoYixcbnRoaXMsYyxmdW5jdGlvbihhLGIpe2EuJHBhcmVudENvbnRleHQ9YjthLiRwYXJlbnQ9Yi4kZGF0YTthLiRwYXJlbnRzPShiLiRwYXJlbnRzfHxbXSkuc2xpY2UoMCk7YS4kcGFyZW50cy51bnNoaWZ0KGEuJHBhcmVudCk7ZCYmZChhKX0sZSl9O2EuZmEucHJvdG90eXBlLmV4dGVuZD1mdW5jdGlvbihiLGMpe3JldHVybiBuZXcgYS5mYShKLHRoaXMsbnVsbCxmdW5jdGlvbihjKXthLmEuZXh0ZW5kKGMsXCJmdW5jdGlvblwiPT10eXBlb2YgYj9iKGMpOmIpfSxjKX07dmFyIHo9YS5hLmcuWigpO2MucHJvdG90eXBlLlRjPWZ1bmN0aW9uKCl7dGhpcy5LYiYmdGhpcy5LYi5OJiZ0aGlzLktiLk4uc2QodGhpcy5ub2RlKX07Yy5wcm90b3R5cGUuc2Q9ZnVuY3Rpb24oYil7YS5hLlBhKHRoaXMua2IsYik7IXRoaXMua2IubGVuZ3RoJiZ0aGlzLkgmJnRoaXMuQ2MoKX07Yy5wcm90b3R5cGUuQ2M9ZnVuY3Rpb24oKXt0aGlzLkg9ITA7dGhpcy55Yy5OJiYhdGhpcy5rYi5sZW5ndGgmJih0aGlzLnljLk49XG5udWxsLGEuYS5LLnliKHRoaXMubm9kZSxiKSxhLmkubWEodGhpcy5ub2RlLGEuaS5wYSksdGhpcy5UYygpKX07YS5pPXtIOlwiY2hpbGRyZW5Db21wbGV0ZVwiLHBhOlwiZGVzY2VuZGFudHNDb21wbGV0ZVwiLHN1YnNjcmliZTpmdW5jdGlvbihiLGMsZCxlLGYpe3ZhciBrPWEuYS5nLlViKGIseix7fSk7ay5GYXx8KGsuRmE9bmV3IGEuVCk7ZiYmZi5ub3RpZnlJbW1lZGlhdGVseSYmay5aYltjXSYmYS51LkcoZCxlLFtiXSk7cmV0dXJuIGsuRmEuc3Vic2NyaWJlKGQsZSxjKX0sbWE6ZnVuY3Rpb24oYixjKXt2YXIgZD1hLmEuZy5nZXQoYix6KTtpZihkJiYoZC5aYltjXT0hMCxkLkZhJiZkLkZhLm5vdGlmeVN1YnNjcmliZXJzKGIsYyksYz09YS5pLkgpKWlmKGQuTilkLk4uQ2MoKTtlbHNlIGlmKGQuTj09PW4mJmQuRmEmJmQuRmEuV2EoYS5pLnBhKSl0aHJvdyBFcnJvcihcImRlc2NlbmRhbnRzQ29tcGxldGUgZXZlbnQgbm90IHN1cHBvcnRlZCBmb3IgYmluZGluZ3Mgb24gdGhpcyBub2RlXCIpO1xufSxDYjpmdW5jdGlvbihiLGQpe3ZhciBlPWEuYS5nLlViKGIseix7fSk7ZS5OfHwoZS5OPW5ldyBjKGIsZSxkW3hdKSk7cmV0dXJuIGRbeF09PWU/ZDpkLmV4dGVuZChmdW5jdGlvbihhKXthW3hdPWV9KX19O2EuVGQ9ZnVuY3Rpb24oYil7cmV0dXJuKGI9YS5hLmcuZ2V0KGIseikpJiZiLmNvbnRleHR9O2EuaWI9ZnVuY3Rpb24oYixjLGQpezE9PT1iLm5vZGVUeXBlJiZhLmguU2MoYik7cmV0dXJuIHAoYixjLHEoZCkpfTthLmxkPWZ1bmN0aW9uKGIsYyxkKXtkPXEoZCk7cmV0dXJuIGEuaWIoYixnKGMsZCxiKSxkKX07YS5PYT1mdW5jdGlvbihhLGIpezEhPT1iLm5vZGVUeXBlJiY4IT09Yi5ub2RlVHlwZXx8bShxKGEpLGIpfTthLnZjPWZ1bmN0aW9uKGEsYixjKXshdiYmQS5qUXVlcnkmJih2PUEualF1ZXJ5KTtpZigyPmFyZ3VtZW50cy5sZW5ndGgpe2lmKGI9dy5ib2R5LCFiKXRocm93IEVycm9yKFwia28uYXBwbHlCaW5kaW5nczogY291bGQgbm90IGZpbmQgZG9jdW1lbnQuYm9keTsgaGFzIHRoZSBkb2N1bWVudCBiZWVuIGxvYWRlZD9cIik7XG59ZWxzZSBpZighYnx8MSE9PWIubm9kZVR5cGUmJjghPT1iLm5vZGVUeXBlKXRocm93IEVycm9yKFwia28uYXBwbHlCaW5kaW5nczogZmlyc3QgcGFyYW1ldGVyIHNob3VsZCBiZSB5b3VyIHZpZXcgbW9kZWw7IHNlY29uZCBwYXJhbWV0ZXIgc2hvdWxkIGJlIGEgRE9NIG5vZGVcIik7ayhxKGEsYyksYil9O2EuRGM9ZnVuY3Rpb24oYil7cmV0dXJuIWJ8fDEhPT1iLm5vZGVUeXBlJiY4IT09Yi5ub2RlVHlwZT9uOmEuVGQoYil9O2EuRWM9ZnVuY3Rpb24oYil7cmV0dXJuKGI9YS5EYyhiKSk/Yi4kZGF0YTpufTthLmIoXCJiaW5kaW5nSGFuZGxlcnNcIixhLmMpO2EuYihcImJpbmRpbmdFdmVudFwiLGEuaSk7YS5iKFwiYmluZGluZ0V2ZW50LnN1YnNjcmliZVwiLGEuaS5zdWJzY3JpYmUpO2EuYihcImJpbmRpbmdFdmVudC5zdGFydFBvc3NpYmx5QXN5bmNDb250ZW50QmluZGluZ1wiLGEuaS5DYik7YS5iKFwiYXBwbHlCaW5kaW5nc1wiLGEudmMpO2EuYihcImFwcGx5QmluZGluZ3NUb0Rlc2NlbmRhbnRzXCIsYS5PYSk7XG5hLmIoXCJhcHBseUJpbmRpbmdBY2Nlc3NvcnNUb05vZGVcIixhLmliKTthLmIoXCJhcHBseUJpbmRpbmdzVG9Ob2RlXCIsYS5sZCk7YS5iKFwiY29udGV4dEZvclwiLGEuRGMpO2EuYihcImRhdGFGb3JcIixhLkVjKX0pKCk7KGZ1bmN0aW9uKGIpe2Z1bmN0aW9uIGMoYyxlKXt2YXIgaz1PYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZixjKT9mW2NdOmIsbDtrP2suc3Vic2NyaWJlKGUpOihrPWZbY109bmV3IGEuVCxrLnN1YnNjcmliZShlKSxkKGMsZnVuY3Rpb24oYixkKXt2YXIgZT0hKCFkfHwhZC5zeW5jaHJvbm91cyk7Z1tjXT17ZGVmaW5pdGlvbjpiLEdkOmV9O2RlbGV0ZSBmW2NdO2x8fGU/ay5ub3RpZnlTdWJzY3JpYmVycyhiKTphLm5hLnpiKGZ1bmN0aW9uKCl7ay5ub3RpZnlTdWJzY3JpYmVycyhiKX0pfSksbD0hMCl9ZnVuY3Rpb24gZChhLGIpe2UoXCJnZXRDb25maWdcIixbYV0sZnVuY3Rpb24oYyl7Yz9lKFwibG9hZENvbXBvbmVudFwiLFthLGNdLGZ1bmN0aW9uKGEpe2IoYSxcbmMpfSk6YihudWxsLG51bGwpfSl9ZnVuY3Rpb24gZShjLGQsZixsKXtsfHwobD1hLmoubG9hZGVycy5zbGljZSgwKSk7dmFyIGc9bC5zaGlmdCgpO2lmKGcpe3ZhciBxPWdbY107aWYocSl7dmFyIHQ9ITE7aWYocS5hcHBseShnLGQuY29uY2F0KGZ1bmN0aW9uKGEpe3Q/ZihudWxsKTpudWxsIT09YT9mKGEpOmUoYyxkLGYsbCl9KSkhPT1iJiYodD0hMCwhZy5zdXBwcmVzc0xvYWRlckV4Y2VwdGlvbnMpKXRocm93IEVycm9yKFwiQ29tcG9uZW50IGxvYWRlcnMgbXVzdCBzdXBwbHkgdmFsdWVzIGJ5IGludm9raW5nIHRoZSBjYWxsYmFjaywgbm90IGJ5IHJldHVybmluZyB2YWx1ZXMgc3luY2hyb25vdXNseS5cIik7fWVsc2UgZShjLGQsZixsKX1lbHNlIGYobnVsbCl9dmFyIGY9e30sZz17fTthLmo9e2dldDpmdW5jdGlvbihkLGUpe3ZhciBmPU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChnLGQpP2dbZF06YjtmP2YuR2Q/YS51LkcoZnVuY3Rpb24oKXtlKGYuZGVmaW5pdGlvbil9KTpcbmEubmEuemIoZnVuY3Rpb24oKXtlKGYuZGVmaW5pdGlvbil9KTpjKGQsZSl9LEJjOmZ1bmN0aW9uKGEpe2RlbGV0ZSBnW2FdfSxvYzplfTthLmoubG9hZGVycz1bXTthLmIoXCJjb21wb25lbnRzXCIsYS5qKTthLmIoXCJjb21wb25lbnRzLmdldFwiLGEuai5nZXQpO2EuYihcImNvbXBvbmVudHMuY2xlYXJDYWNoZWREZWZpbml0aW9uXCIsYS5qLkJjKX0pKCk7KGZ1bmN0aW9uKCl7ZnVuY3Rpb24gYihiLGMsZCxlKXtmdW5jdGlvbiBnKCl7MD09PS0tQiYmZShoKX12YXIgaD17fSxCPTIsdT1kLnRlbXBsYXRlO2Q9ZC52aWV3TW9kZWw7dT9mKGMsdSxmdW5jdGlvbihjKXthLmoub2MoXCJsb2FkVGVtcGxhdGVcIixbYixjXSxmdW5jdGlvbihhKXtoLnRlbXBsYXRlPWE7ZygpfSl9KTpnKCk7ZD9mKGMsZCxmdW5jdGlvbihjKXthLmoub2MoXCJsb2FkVmlld01vZGVsXCIsW2IsY10sZnVuY3Rpb24oYSl7aFttXT1hO2coKX0pfSk6ZygpfWZ1bmN0aW9uIGMoYSxiLGQpe2lmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBiKWQoZnVuY3Rpb24oYSl7cmV0dXJuIG5ldyBiKGEpfSk7XG5lbHNlIGlmKFwiZnVuY3Rpb25cIj09PXR5cGVvZiBiW21dKWQoYlttXSk7ZWxzZSBpZihcImluc3RhbmNlXCJpbiBiKXt2YXIgZT1iLmluc3RhbmNlO2QoZnVuY3Rpb24oKXtyZXR1cm4gZX0pfWVsc2VcInZpZXdNb2RlbFwiaW4gYj9jKGEsYi52aWV3TW9kZWwsZCk6YShcIlVua25vd24gdmlld01vZGVsIHZhbHVlOiBcIitiKX1mdW5jdGlvbiBkKGIpe3N3aXRjaChhLmEuUihiKSl7Y2FzZSBcInNjcmlwdFwiOnJldHVybiBhLmEudWEoYi50ZXh0KTtjYXNlIFwidGV4dGFyZWFcIjpyZXR1cm4gYS5hLnVhKGIudmFsdWUpO2Nhc2UgXCJ0ZW1wbGF0ZVwiOmlmKGUoYi5jb250ZW50KSlyZXR1cm4gYS5hLkNhKGIuY29udGVudC5jaGlsZE5vZGVzKX1yZXR1cm4gYS5hLkNhKGIuY2hpbGROb2Rlcyl9ZnVuY3Rpb24gZShhKXtyZXR1cm4gQS5Eb2N1bWVudEZyYWdtZW50P2EgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50OmEmJjExPT09YS5ub2RlVHlwZX1mdW5jdGlvbiBmKGEsYixjKXtcInN0cmluZ1wiPT09dHlwZW9mIGIucmVxdWlyZT9cblR8fEEucmVxdWlyZT8oVHx8QS5yZXF1aXJlKShbYi5yZXF1aXJlXSxmdW5jdGlvbihhKXthJiZcIm9iamVjdFwiPT09dHlwZW9mIGEmJmEuWGQmJmFbXCJkZWZhdWx0XCJdJiYoYT1hW1wiZGVmYXVsdFwiXSk7YyhhKX0pOmEoXCJVc2VzIHJlcXVpcmUsIGJ1dCBubyBBTUQgbG9hZGVyIGlzIHByZXNlbnRcIik6YyhiKX1mdW5jdGlvbiBnKGEpe3JldHVybiBmdW5jdGlvbihiKXt0aHJvdyBFcnJvcihcIkNvbXBvbmVudCAnXCIrYStcIic6IFwiK2IpO319dmFyIGg9e307YS5qLnJlZ2lzdGVyPWZ1bmN0aW9uKGIsYyl7aWYoIWMpdGhyb3cgRXJyb3IoXCJJbnZhbGlkIGNvbmZpZ3VyYXRpb24gZm9yIFwiK2IpO2lmKGEuai50YihiKSl0aHJvdyBFcnJvcihcIkNvbXBvbmVudCBcIitiK1wiIGlzIGFscmVhZHkgcmVnaXN0ZXJlZFwiKTtoW2JdPWN9O2Euai50Yj1mdW5jdGlvbihhKXtyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGgsYSl9O2Euai51bnJlZ2lzdGVyPWZ1bmN0aW9uKGIpe2RlbGV0ZSBoW2JdO1xuYS5qLkJjKGIpfTthLmouRmM9e2dldENvbmZpZzpmdW5jdGlvbihiLGMpe2MoYS5qLnRiKGIpP2hbYl06bnVsbCl9LGxvYWRDb21wb25lbnQ6ZnVuY3Rpb24oYSxjLGQpe3ZhciBlPWcoYSk7ZihlLGMsZnVuY3Rpb24oYyl7YihhLGUsYyxkKX0pfSxsb2FkVGVtcGxhdGU6ZnVuY3Rpb24oYixjLGYpe2I9ZyhiKTtpZihcInN0cmluZ1wiPT09dHlwZW9mIGMpZihhLmEudWEoYykpO2Vsc2UgaWYoYyBpbnN0YW5jZW9mIEFycmF5KWYoYyk7ZWxzZSBpZihlKGMpKWYoYS5hLmxhKGMuY2hpbGROb2RlcykpO2Vsc2UgaWYoYy5lbGVtZW50KWlmKGM9Yy5lbGVtZW50LEEuSFRNTEVsZW1lbnQ/YyBpbnN0YW5jZW9mIEhUTUxFbGVtZW50OmMmJmMudGFnTmFtZSYmMT09PWMubm9kZVR5cGUpZihkKGMpKTtlbHNlIGlmKFwic3RyaW5nXCI9PT10eXBlb2YgYyl7dmFyIGg9dy5nZXRFbGVtZW50QnlJZChjKTtoP2YoZChoKSk6YihcIkNhbm5vdCBmaW5kIGVsZW1lbnQgd2l0aCBJRCBcIitjKX1lbHNlIGIoXCJVbmtub3duIGVsZW1lbnQgdHlwZTogXCIrXG5jKTtlbHNlIGIoXCJVbmtub3duIHRlbXBsYXRlIHZhbHVlOiBcIitjKX0sbG9hZFZpZXdNb2RlbDpmdW5jdGlvbihhLGIsZCl7YyhnKGEpLGIsZCl9fTt2YXIgbT1cImNyZWF0ZVZpZXdNb2RlbFwiO2EuYihcImNvbXBvbmVudHMucmVnaXN0ZXJcIixhLmoucmVnaXN0ZXIpO2EuYihcImNvbXBvbmVudHMuaXNSZWdpc3RlcmVkXCIsYS5qLnRiKTthLmIoXCJjb21wb25lbnRzLnVucmVnaXN0ZXJcIixhLmoudW5yZWdpc3Rlcik7YS5iKFwiY29tcG9uZW50cy5kZWZhdWx0TG9hZGVyXCIsYS5qLkZjKTthLmoubG9hZGVycy5wdXNoKGEuai5GYyk7YS5qLmRkPWh9KSgpOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGIoYixlKXt2YXIgZj1iLmdldEF0dHJpYnV0ZShcInBhcmFtc1wiKTtpZihmKXt2YXIgZj1jLnBhcnNlQmluZGluZ3NTdHJpbmcoZixlLGIse3ZhbHVlQWNjZXNzb3JzOiEwLGJpbmRpbmdQYXJhbXM6ITB9KSxmPWEuYS5HYShmLGZ1bmN0aW9uKGMpe3JldHVybiBhLm8oYyxudWxsLHtsOmJ9KX0pLGc9YS5hLkdhKGYsXG5mdW5jdGlvbihjKXt2YXIgZT1jLnYoKTtyZXR1cm4gYy5qYSgpP2Eubyh7cmVhZDpmdW5jdGlvbigpe3JldHVybiBhLmEuZihjKCkpfSx3cml0ZTphLlphKGUpJiZmdW5jdGlvbihhKXtjKCkoYSl9LGw6Yn0pOmV9KTtPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZyxcIiRyYXdcIil8fChnLiRyYXc9Zik7cmV0dXJuIGd9cmV0dXJueyRyYXc6e319fWEuai5nZXRDb21wb25lbnROYW1lRm9yTm9kZT1mdW5jdGlvbihiKXt2YXIgYz1hLmEuUihiKTtpZihhLmoudGIoYykmJigtMSE9Yy5pbmRleE9mKFwiLVwiKXx8XCJbb2JqZWN0IEhUTUxVbmtub3duRWxlbWVudF1cIj09XCJcIitifHw4Pj1hLmEuVyYmYi50YWdOYW1lPT09YykpcmV0dXJuIGN9O2Euai50Yz1mdW5jdGlvbihjLGUsZixnKXtpZigxPT09ZS5ub2RlVHlwZSl7dmFyIGg9YS5qLmdldENvbXBvbmVudE5hbWVGb3JOb2RlKGUpO2lmKGgpe2M9Y3x8e307aWYoYy5jb21wb25lbnQpdGhyb3cgRXJyb3IoJ0Nhbm5vdCB1c2UgdGhlIFwiY29tcG9uZW50XCIgYmluZGluZyBvbiBhIGN1c3RvbSBlbGVtZW50IG1hdGNoaW5nIGEgY29tcG9uZW50Jyk7XG52YXIgbT17bmFtZTpoLHBhcmFtczpiKGUsZil9O2MuY29tcG9uZW50PWc/ZnVuY3Rpb24oKXtyZXR1cm4gbX06bX19cmV0dXJuIGN9O3ZhciBjPW5ldyBhLmdhOzk+YS5hLlcmJihhLmoucmVnaXN0ZXI9ZnVuY3Rpb24oYSl7cmV0dXJuIGZ1bmN0aW9uKGIpe3JldHVybiBhLmFwcGx5KHRoaXMsYXJndW1lbnRzKX19KGEuai5yZWdpc3Rlciksdy5jcmVhdGVEb2N1bWVudEZyYWdtZW50PWZ1bmN0aW9uKGIpe3JldHVybiBmdW5jdGlvbigpe3ZhciBjPWIoKSxmPWEuai5kZCxnO2ZvcihnIGluIGYpO3JldHVybiBjfX0ody5jcmVhdGVEb2N1bWVudEZyYWdtZW50KSl9KSgpOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGIoYixjLGQpe2M9Yy50ZW1wbGF0ZTtpZighYyl0aHJvdyBFcnJvcihcIkNvbXBvbmVudCAnXCIrYitcIicgaGFzIG5vIHRlbXBsYXRlXCIpO2I9YS5hLkNhKGMpO2EuaC52YShkLGIpfWZ1bmN0aW9uIGMoYSxiLGMpe3ZhciBkPWEuY3JlYXRlVmlld01vZGVsO3JldHVybiBkP2QuY2FsbChhLFxuYixjKTpifXZhciBkPTA7YS5jLmNvbXBvbmVudD17aW5pdDpmdW5jdGlvbihlLGYsZyxoLG0pe2Z1bmN0aW9uIGsoKXt2YXIgYT1sJiZsLmRpc3Bvc2U7XCJmdW5jdGlvblwiPT09dHlwZW9mIGEmJmEuY2FsbChsKTtxJiZxLnMoKTtwPWw9cT1udWxsfXZhciBsLHAscSx0PWEuYS5sYShhLmguY2hpbGROb2RlcyhlKSk7YS5oLkVhKGUpO2EuYS5LLnphKGUsayk7YS5vKGZ1bmN0aW9uKCl7dmFyIGc9YS5hLmYoZigpKSxoLHU7XCJzdHJpbmdcIj09PXR5cGVvZiBnP2g9ZzooaD1hLmEuZihnLm5hbWUpLHU9YS5hLmYoZy5wYXJhbXMpKTtpZighaCl0aHJvdyBFcnJvcihcIk5vIGNvbXBvbmVudCBuYW1lIHNwZWNpZmllZFwiKTt2YXIgbj1hLmkuQ2IoZSxtKSx6PXA9KytkO2Euai5nZXQoaCxmdW5jdGlvbihkKXtpZihwPT09eil7aygpO2lmKCFkKXRocm93IEVycm9yKFwiVW5rbm93biBjb21wb25lbnQgJ1wiK2grXCInXCIpO2IoaCxkLGUpO3ZhciBmPWMoZCx1LHtlbGVtZW50OmUsdGVtcGxhdGVOb2Rlczp0fSk7XG5kPW4uY3JlYXRlQ2hpbGRDb250ZXh0KGYse2V4dGVuZDpmdW5jdGlvbihhKXthLiRjb21wb25lbnQ9ZjthLiRjb21wb25lbnRUZW1wbGF0ZU5vZGVzPXR9fSk7ZiYmZi5rb0Rlc2NlbmRhbnRzQ29tcGxldGUmJihxPWEuaS5zdWJzY3JpYmUoZSxhLmkucGEsZi5rb0Rlc2NlbmRhbnRzQ29tcGxldGUsZikpO2w9ZjthLk9hKGQsZSl9fSl9LG51bGwse2w6ZX0pO3JldHVybntjb250cm9sc0Rlc2NlbmRhbnRCaW5kaW5nczohMH19fTthLmguZWEuY29tcG9uZW50PSEwfSkoKTt2YXIgVj17XCJjbGFzc1wiOlwiY2xhc3NOYW1lXCIsXCJmb3JcIjpcImh0bWxGb3JcIn07YS5jLmF0dHI9e3VwZGF0ZTpmdW5jdGlvbihiLGMpe3ZhciBkPWEuYS5mKGMoKSl8fHt9O2EuYS5QKGQsZnVuY3Rpb24oYyxkKXtkPWEuYS5mKGQpO3ZhciBnPWMuaW5kZXhPZihcIjpcIiksZz1cImxvb2t1cE5hbWVzcGFjZVVSSVwiaW4gYiYmMDxnJiZiLmxvb2t1cE5hbWVzcGFjZVVSSShjLnN1YnN0cigwLGcpKSxoPSExPT09ZHx8bnVsbD09PVxuZHx8ZD09PW47aD9nP2IucmVtb3ZlQXR0cmlidXRlTlMoZyxjKTpiLnJlbW92ZUF0dHJpYnV0ZShjKTpkPWQudG9TdHJpbmcoKTs4Pj1hLmEuVyYmYyBpbiBWPyhjPVZbY10saD9iLnJlbW92ZUF0dHJpYnV0ZShjKTpiW2NdPWQpOmh8fChnP2Iuc2V0QXR0cmlidXRlTlMoZyxjLGQpOmIuc2V0QXR0cmlidXRlKGMsZCkpO1wibmFtZVwiPT09YyYmYS5hLlljKGIsaD9cIlwiOmQpfSl9fTsoZnVuY3Rpb24oKXthLmMuY2hlY2tlZD17YWZ0ZXI6W1widmFsdWVcIixcImF0dHJcIl0saW5pdDpmdW5jdGlvbihiLGMsZCl7ZnVuY3Rpb24gZSgpe3ZhciBlPWIuY2hlY2tlZCxmPWcoKTtpZighYS5TLllhKCkmJihlfHwhbSYmIWEuUy5xYSgpKSl7dmFyIGs9YS51LkcoYyk7aWYobCl7dmFyIHE9cD9rLnYoKTprLHo9dDt0PWY7eiE9PWY/ZSYmKGEuYS5OYShxLGYsITApLGEuYS5OYShxLHosITEpKTphLmEuTmEocSxmLGUpO3AmJmEuWmEoaykmJmsocSl9ZWxzZSBoJiYoZj09PW4/Zj1lOmV8fChmPW4pKSxhLm0uZWIoayxcbmQsXCJjaGVja2VkXCIsZiwhMCl9fWZ1bmN0aW9uIGYoKXt2YXIgZD1hLmEuZihjKCkpLGU9ZygpO2w/KGIuY2hlY2tlZD0wPD1hLmEuQShkLGUpLHQ9ZSk6Yi5jaGVja2VkPWgmJmU9PT1uPyEhZDpnKCk9PT1kfXZhciBnPWEueGIoZnVuY3Rpb24oKXtpZihkLmhhcyhcImNoZWNrZWRWYWx1ZVwiKSlyZXR1cm4gYS5hLmYoZC5nZXQoXCJjaGVja2VkVmFsdWVcIikpO2lmKHEpcmV0dXJuIGQuaGFzKFwidmFsdWVcIik/YS5hLmYoZC5nZXQoXCJ2YWx1ZVwiKSk6Yi52YWx1ZX0pLGg9XCJjaGVja2JveFwiPT1iLnR5cGUsbT1cInJhZGlvXCI9PWIudHlwZTtpZihofHxtKXt2YXIgaz1jKCksbD1oJiZhLmEuZihrKWluc3RhbmNlb2YgQXJyYXkscD0hKGwmJmsucHVzaCYmay5zcGxpY2UpLHE9bXx8bCx0PWw/ZygpOm47bSYmIWIubmFtZSYmYS5jLnVuaXF1ZU5hbWUuaW5pdChiLGZ1bmN0aW9uKCl7cmV0dXJuITB9KTthLm8oZSxudWxsLHtsOmJ9KTthLmEuQihiLFwiY2xpY2tcIixlKTthLm8oZixudWxsLHtsOmJ9KTtcbms9bn19fTthLm0ud2EuY2hlY2tlZD0hMDthLmMuY2hlY2tlZFZhbHVlPXt1cGRhdGU6ZnVuY3Rpb24oYixjKXtiLnZhbHVlPWEuYS5mKGMoKSl9fX0pKCk7YS5jW1wiY2xhc3NcIl09e3VwZGF0ZTpmdW5jdGlvbihiLGMpe3ZhciBkPWEuYS5EYihhLmEuZihjKCkpKTthLmEuRWIoYixiLl9fa29fX2Nzc1ZhbHVlLCExKTtiLl9fa29fX2Nzc1ZhbHVlPWQ7YS5hLkViKGIsZCwhMCl9fTthLmMuY3NzPXt1cGRhdGU6ZnVuY3Rpb24oYixjKXt2YXIgZD1hLmEuZihjKCkpO251bGwhPT1kJiZcIm9iamVjdFwiPT10eXBlb2YgZD9hLmEuUChkLGZ1bmN0aW9uKGMsZCl7ZD1hLmEuZihkKTthLmEuRWIoYixjLGQpfSk6YS5jW1wiY2xhc3NcIl0udXBkYXRlKGIsYyl9fTthLmMuZW5hYmxlPXt1cGRhdGU6ZnVuY3Rpb24oYixjKXt2YXIgZD1hLmEuZihjKCkpO2QmJmIuZGlzYWJsZWQ/Yi5yZW1vdmVBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKTpkfHxiLmRpc2FibGVkfHwoYi5kaXNhYmxlZD0hMCl9fTthLmMuZGlzYWJsZT1cbnt1cGRhdGU6ZnVuY3Rpb24oYixjKXthLmMuZW5hYmxlLnVwZGF0ZShiLGZ1bmN0aW9uKCl7cmV0dXJuIWEuYS5mKGMoKSl9KX19O2EuYy5ldmVudD17aW5pdDpmdW5jdGlvbihiLGMsZCxlLGYpe3ZhciBnPWMoKXx8e307YS5hLlAoZyxmdW5jdGlvbihnKXtcInN0cmluZ1wiPT10eXBlb2YgZyYmYS5hLkIoYixnLGZ1bmN0aW9uKGIpe3ZhciBrLGw9YygpW2ddO2lmKGwpe3RyeXt2YXIgcD1hLmEubGEoYXJndW1lbnRzKTtlPWYuJGRhdGE7cC51bnNoaWZ0KGUpO2s9bC5hcHBseShlLHApfWZpbmFsbHl7ITAhPT1rJiYoYi5wcmV2ZW50RGVmYXVsdD9iLnByZXZlbnREZWZhdWx0KCk6Yi5yZXR1cm5WYWx1ZT0hMSl9ITE9PT1kLmdldChnK1wiQnViYmxlXCIpJiYoYi5jYW5jZWxCdWJibGU9ITAsYi5zdG9wUHJvcGFnYXRpb24mJmIuc3RvcFByb3BhZ2F0aW9uKCkpfX0pfSl9fTthLmMuZm9yZWFjaD17UmM6ZnVuY3Rpb24oYil7cmV0dXJuIGZ1bmN0aW9uKCl7dmFyIGM9YigpLGQ9YS5hLmJjKGMpO1xuaWYoIWR8fFwibnVtYmVyXCI9PXR5cGVvZiBkLmxlbmd0aClyZXR1cm57Zm9yZWFjaDpjLHRlbXBsYXRlRW5naW5lOmEuYmEuTWF9O2EuYS5mKGMpO3JldHVybntmb3JlYWNoOmQuZGF0YSxhczpkLmFzLG5vQ2hpbGRDb250ZXh0OmQubm9DaGlsZENvbnRleHQsaW5jbHVkZURlc3Ryb3llZDpkLmluY2x1ZGVEZXN0cm95ZWQsYWZ0ZXJBZGQ6ZC5hZnRlckFkZCxiZWZvcmVSZW1vdmU6ZC5iZWZvcmVSZW1vdmUsYWZ0ZXJSZW5kZXI6ZC5hZnRlclJlbmRlcixiZWZvcmVNb3ZlOmQuYmVmb3JlTW92ZSxhZnRlck1vdmU6ZC5hZnRlck1vdmUsdGVtcGxhdGVFbmdpbmU6YS5iYS5NYX19fSxpbml0OmZ1bmN0aW9uKGIsYyl7cmV0dXJuIGEuYy50ZW1wbGF0ZS5pbml0KGIsYS5jLmZvcmVhY2guUmMoYykpfSx1cGRhdGU6ZnVuY3Rpb24oYixjLGQsZSxmKXtyZXR1cm4gYS5jLnRlbXBsYXRlLnVwZGF0ZShiLGEuYy5mb3JlYWNoLlJjKGMpLGQsZSxmKX19O2EubS5SYS5mb3JlYWNoPSExO2EuaC5lYS5mb3JlYWNoPVxuITA7YS5jLmhhc2ZvY3VzPXtpbml0OmZ1bmN0aW9uKGIsYyxkKXtmdW5jdGlvbiBlKGUpe2IuX19rb19oYXNmb2N1c1VwZGF0aW5nPSEwO3ZhciBmPWIub3duZXJEb2N1bWVudDtpZihcImFjdGl2ZUVsZW1lbnRcImluIGYpe3ZhciBnO3RyeXtnPWYuYWN0aXZlRWxlbWVudH1jYXRjaChsKXtnPWYuYm9keX1lPWc9PT1ifWY9YygpO2EubS5lYihmLGQsXCJoYXNmb2N1c1wiLGUsITApO2IuX19rb19oYXNmb2N1c0xhc3RWYWx1ZT1lO2IuX19rb19oYXNmb2N1c1VwZGF0aW5nPSExfXZhciBmPWUuYmluZChudWxsLCEwKSxnPWUuYmluZChudWxsLCExKTthLmEuQihiLFwiZm9jdXNcIixmKTthLmEuQihiLFwiZm9jdXNpblwiLGYpO2EuYS5CKGIsXCJibHVyXCIsZyk7YS5hLkIoYixcImZvY3Vzb3V0XCIsZyk7Yi5fX2tvX2hhc2ZvY3VzTGFzdFZhbHVlPSExfSx1cGRhdGU6ZnVuY3Rpb24oYixjKXt2YXIgZD0hIWEuYS5mKGMoKSk7Yi5fX2tvX2hhc2ZvY3VzVXBkYXRpbmd8fGIuX19rb19oYXNmb2N1c0xhc3RWYWx1ZT09PVxuZHx8KGQ/Yi5mb2N1cygpOmIuYmx1cigpLCFkJiZiLl9fa29faGFzZm9jdXNMYXN0VmFsdWUmJmIub3duZXJEb2N1bWVudC5ib2R5LmZvY3VzKCksYS51LkcoYS5hLkZiLG51bGwsW2IsZD9cImZvY3VzaW5cIjpcImZvY3Vzb3V0XCJdKSl9fTthLm0ud2EuaGFzZm9jdXM9ITA7YS5jLmhhc0ZvY3VzPWEuYy5oYXNmb2N1czthLm0ud2EuaGFzRm9jdXM9XCJoYXNmb2N1c1wiO2EuYy5odG1sPXtpbml0OmZ1bmN0aW9uKCl7cmV0dXJue2NvbnRyb2xzRGVzY2VuZGFudEJpbmRpbmdzOiEwfX0sdXBkYXRlOmZ1bmN0aW9uKGIsYyl7YS5hLmZjKGIsYygpKX19OyhmdW5jdGlvbigpe2Z1bmN0aW9uIGIoYixkLGUpe2EuY1tiXT17aW5pdDpmdW5jdGlvbihiLGMsaCxtLGspe3ZhciBsLHAscT17fSx0LHgsbjtpZihkKXttPWguZ2V0KFwiYXNcIik7dmFyIHU9aC5nZXQoXCJub0NoaWxkQ29udGV4dFwiKTtuPSEobSYmdSk7cT17YXM6bSxub0NoaWxkQ29udGV4dDp1LGV4cG9ydERlcGVuZGVuY2llczpufX14PSh0PVxuXCJyZW5kZXJcIj09aC5nZXQoXCJjb21wbGV0ZU9uXCIpKXx8aC5oYXMoYS5pLnBhKTthLm8oZnVuY3Rpb24oKXt2YXIgaD1hLmEuZihjKCkpLG09IWUhPT0haCx1PSFwLHI7aWYobnx8bSE9PWwpe3gmJihrPWEuaS5DYihiLGspKTtpZihtKXtpZighZHx8bilxLmRhdGFEZXBlbmRlbmN5PWEuUy5vKCk7cj1kP2suY3JlYXRlQ2hpbGRDb250ZXh0KFwiZnVuY3Rpb25cIj09dHlwZW9mIGg/aDpjLHEpOmEuUy5xYSgpP2suZXh0ZW5kKG51bGwscSk6a311JiZhLlMucWEoKSYmKHA9YS5hLkNhKGEuaC5jaGlsZE5vZGVzKGIpLCEwKSk7bT8odXx8YS5oLnZhKGIsYS5hLkNhKHApKSxhLk9hKHIsYikpOihhLmguRWEoYiksdHx8YS5pLm1hKGIsYS5pLkgpKTtsPW19fSxudWxsLHtsOmJ9KTtyZXR1cm57Y29udHJvbHNEZXNjZW5kYW50QmluZGluZ3M6ITB9fX07YS5tLlJhW2JdPSExO2EuaC5lYVtiXT0hMH1iKFwiaWZcIik7YihcImlmbm90XCIsITEsITApO2IoXCJ3aXRoXCIsITApfSkoKTthLmMubGV0PXtpbml0OmZ1bmN0aW9uKGIsXG5jLGQsZSxmKXtjPWYuZXh0ZW5kKGMpO2EuT2EoYyxiKTtyZXR1cm57Y29udHJvbHNEZXNjZW5kYW50QmluZGluZ3M6ITB9fX07YS5oLmVhLmxldD0hMDt2YXIgUT17fTthLmMub3B0aW9ucz17aW5pdDpmdW5jdGlvbihiKXtpZihcInNlbGVjdFwiIT09YS5hLlIoYikpdGhyb3cgRXJyb3IoXCJvcHRpb25zIGJpbmRpbmcgYXBwbGllcyBvbmx5IHRvIFNFTEVDVCBlbGVtZW50c1wiKTtmb3IoOzA8Yi5sZW5ndGg7KWIucmVtb3ZlKDApO3JldHVybntjb250cm9sc0Rlc2NlbmRhbnRCaW5kaW5nczohMH19LHVwZGF0ZTpmdW5jdGlvbihiLGMsZCl7ZnVuY3Rpb24gZSgpe3JldHVybiBhLmEuamIoYi5vcHRpb25zLGZ1bmN0aW9uKGEpe3JldHVybiBhLnNlbGVjdGVkfSl9ZnVuY3Rpb24gZihhLGIsYyl7dmFyIGQ9dHlwZW9mIGI7cmV0dXJuXCJmdW5jdGlvblwiPT1kP2IoYSk6XCJzdHJpbmdcIj09ZD9hW2JdOmN9ZnVuY3Rpb24gZyhjLGQpe2lmKHgmJmwpYS5pLm1hKGIsYS5pLkgpO2Vsc2UgaWYodC5sZW5ndGgpe3ZhciBlPVxuMDw9YS5hLkEodCxhLncuTShkWzBdKSk7YS5hLlpjKGRbMF0sZSk7eCYmIWUmJmEudS5HKGEuYS5GYixudWxsLFtiLFwiY2hhbmdlXCJdKX19dmFyIGg9Yi5tdWx0aXBsZSxtPTAhPWIubGVuZ3RoJiZoP2Iuc2Nyb2xsVG9wOm51bGwsaz1hLmEuZihjKCkpLGw9ZC5nZXQoXCJ2YWx1ZUFsbG93VW5zZXRcIikmJmQuaGFzKFwidmFsdWVcIikscD1kLmdldChcIm9wdGlvbnNJbmNsdWRlRGVzdHJveWVkXCIpO2M9e307dmFyIHEsdD1bXTtsfHwoaD90PWEuYS5NYihlKCksYS53Lk0pOjA8PWIuc2VsZWN0ZWRJbmRleCYmdC5wdXNoKGEudy5NKGIub3B0aW9uc1tiLnNlbGVjdGVkSW5kZXhdKSkpO2smJihcInVuZGVmaW5lZFwiPT10eXBlb2Ygay5sZW5ndGgmJihrPVtrXSkscT1hLmEuamIoayxmdW5jdGlvbihiKXtyZXR1cm4gcHx8Yj09PW58fG51bGw9PT1ifHwhYS5hLmYoYi5fZGVzdHJveSl9KSxkLmhhcyhcIm9wdGlvbnNDYXB0aW9uXCIpJiYoaz1hLmEuZihkLmdldChcIm9wdGlvbnNDYXB0aW9uXCIpKSxudWxsIT09XG5rJiZrIT09biYmcS51bnNoaWZ0KFEpKSk7dmFyIHg9ITE7Yy5iZWZvcmVSZW1vdmU9ZnVuY3Rpb24oYSl7Yi5yZW1vdmVDaGlsZChhKX07az1nO2QuaGFzKFwib3B0aW9uc0FmdGVyUmVuZGVyXCIpJiZcImZ1bmN0aW9uXCI9PXR5cGVvZiBkLmdldChcIm9wdGlvbnNBZnRlclJlbmRlclwiKSYmKGs9ZnVuY3Rpb24oYixjKXtnKDAsYyk7YS51LkcoZC5nZXQoXCJvcHRpb25zQWZ0ZXJSZW5kZXJcIiksbnVsbCxbY1swXSxiIT09UT9iOm5dKX0pO2EuYS5lYyhiLHEsZnVuY3Rpb24oYyxlLGcpe2cubGVuZ3RoJiYodD0hbCYmZ1swXS5zZWxlY3RlZD9bYS53Lk0oZ1swXSldOltdLHg9ITApO2U9Yi5vd25lckRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJvcHRpb25cIik7Yz09PVE/KGEuYS5CYihlLGQuZ2V0KFwib3B0aW9uc0NhcHRpb25cIikpLGEudy5jYihlLG4pKTooZz1mKGMsZC5nZXQoXCJvcHRpb25zVmFsdWVcIiksYyksYS53LmNiKGUsYS5hLmYoZykpLGM9ZihjLGQuZ2V0KFwib3B0aW9uc1RleHRcIiksZyksXG5hLmEuQmIoZSxjKSk7cmV0dXJuW2VdfSxjLGspO2lmKCFsKXt2YXIgQjtoP0I9dC5sZW5ndGgmJmUoKS5sZW5ndGg8dC5sZW5ndGg6Qj10Lmxlbmd0aCYmMDw9Yi5zZWxlY3RlZEluZGV4P2Eudy5NKGIub3B0aW9uc1tiLnNlbGVjdGVkSW5kZXhdKSE9PXRbMF06dC5sZW5ndGh8fDA8PWIuc2VsZWN0ZWRJbmRleDtCJiZhLnUuRyhhLmEuRmIsbnVsbCxbYixcImNoYW5nZVwiXSl9KGx8fGEuUy5ZYSgpKSYmYS5pLm1hKGIsYS5pLkgpO2EuYS53ZChiKTttJiYyMDxNYXRoLmFicyhtLWIuc2Nyb2xsVG9wKSYmKGIuc2Nyb2xsVG9wPW0pfX07YS5jLm9wdGlvbnMuJGI9YS5hLmcuWigpO2EuYy5zZWxlY3RlZE9wdGlvbnM9e2luaXQ6ZnVuY3Rpb24oYixjLGQpe2Z1bmN0aW9uIGUoKXt2YXIgZT1jKCksZj1bXTthLmEuRChiLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwib3B0aW9uXCIpLGZ1bmN0aW9uKGIpe2Iuc2VsZWN0ZWQmJmYucHVzaChhLncuTShiKSl9KTthLm0uZWIoZSxkLFwic2VsZWN0ZWRPcHRpb25zXCIsXG5mKX1mdW5jdGlvbiBmKCl7dmFyIGQ9YS5hLmYoYygpKSxlPWIuc2Nyb2xsVG9wO2QmJlwibnVtYmVyXCI9PXR5cGVvZiBkLmxlbmd0aCYmYS5hLkQoYi5nZXRFbGVtZW50c0J5VGFnTmFtZShcIm9wdGlvblwiKSxmdW5jdGlvbihiKXt2YXIgYz0wPD1hLmEuQShkLGEudy5NKGIpKTtiLnNlbGVjdGVkIT1jJiZhLmEuWmMoYixjKX0pO2Iuc2Nyb2xsVG9wPWV9aWYoXCJzZWxlY3RcIiE9YS5hLlIoYikpdGhyb3cgRXJyb3IoXCJzZWxlY3RlZE9wdGlvbnMgYmluZGluZyBhcHBsaWVzIG9ubHkgdG8gU0VMRUNUIGVsZW1lbnRzXCIpO3ZhciBnO2EuaS5zdWJzY3JpYmUoYixhLmkuSCxmdW5jdGlvbigpe2c/ZSgpOihhLmEuQihiLFwiY2hhbmdlXCIsZSksZz1hLm8oZixudWxsLHtsOmJ9KSl9LG51bGwse25vdGlmeUltbWVkaWF0ZWx5OiEwfSl9LHVwZGF0ZTpmdW5jdGlvbigpe319O2EubS53YS5zZWxlY3RlZE9wdGlvbnM9ITA7YS5jLnN0eWxlPXt1cGRhdGU6ZnVuY3Rpb24oYixjKXt2YXIgZD1hLmEuZihjKCl8fFxue30pO2EuYS5QKGQsZnVuY3Rpb24oYyxkKXtkPWEuYS5mKGQpO2lmKG51bGw9PT1kfHxkPT09bnx8ITE9PT1kKWQ9XCJcIjtpZih2KXYoYikuY3NzKGMsZCk7ZWxzZSBpZigvXi0tLy50ZXN0KGMpKWIuc3R5bGUuc2V0UHJvcGVydHkoYyxkKTtlbHNle2M9Yy5yZXBsYWNlKC8tKFxcdykvZyxmdW5jdGlvbihhLGIpe3JldHVybiBiLnRvVXBwZXJDYXNlKCl9KTt2YXIgZz1iLnN0eWxlW2NdO2Iuc3R5bGVbY109ZDtkPT09Z3x8Yi5zdHlsZVtjXSE9Z3x8aXNOYU4oZCl8fChiLnN0eWxlW2NdPWQrXCJweFwiKX19KX19O2EuYy5zdWJtaXQ9e2luaXQ6ZnVuY3Rpb24oYixjLGQsZSxmKXtpZihcImZ1bmN0aW9uXCIhPXR5cGVvZiBjKCkpdGhyb3cgRXJyb3IoXCJUaGUgdmFsdWUgZm9yIGEgc3VibWl0IGJpbmRpbmcgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO2EuYS5CKGIsXCJzdWJtaXRcIixmdW5jdGlvbihhKXt2YXIgZCxlPWMoKTt0cnl7ZD1lLmNhbGwoZi4kZGF0YSxiKX1maW5hbGx5eyEwIT09ZCYmKGEucHJldmVudERlZmF1bHQ/XG5hLnByZXZlbnREZWZhdWx0KCk6YS5yZXR1cm5WYWx1ZT0hMSl9fSl9fTthLmMudGV4dD17aW5pdDpmdW5jdGlvbigpe3JldHVybntjb250cm9sc0Rlc2NlbmRhbnRCaW5kaW5nczohMH19LHVwZGF0ZTpmdW5jdGlvbihiLGMpe2EuYS5CYihiLGMoKSl9fTthLmguZWEudGV4dD0hMDsoZnVuY3Rpb24oKXtpZihBJiZBLm5hdmlnYXRvcil7dmFyIGI9ZnVuY3Rpb24oYSl7aWYoYSlyZXR1cm4gcGFyc2VGbG9hdChhWzFdKX0sYz1BLm5hdmlnYXRvci51c2VyQWdlbnQsZCxlLGYsZyxoOyhkPUEub3BlcmEmJkEub3BlcmEudmVyc2lvbiYmcGFyc2VJbnQoQS5vcGVyYS52ZXJzaW9uKCkpKXx8KGg9YihjLm1hdGNoKC9FZGdlXFwvKFteIF0rKSQvKSkpfHxiKGMubWF0Y2goL0Nocm9tZVxcLyhbXiBdKykvKSl8fChlPWIoYy5tYXRjaCgvVmVyc2lvblxcLyhbXiBdKykgU2FmYXJpLykpKXx8KGY9YihjLm1hdGNoKC9GaXJlZm94XFwvKFteIF0rKS8pKSl8fChnPWEuYS5XfHxiKGMubWF0Y2goL01TSUUgKFteIF0rKS8pKSl8fFxuKGc9YihjLm1hdGNoKC9ydjooW14gKV0rKS8pKSl9aWYoODw9ZyYmMTA+Zyl2YXIgbT1hLmEuZy5aKCksaz1hLmEuZy5aKCksbD1mdW5jdGlvbihiKXt2YXIgYz10aGlzLmFjdGl2ZUVsZW1lbnQ7KGM9YyYmYS5hLmcuZ2V0KGMsaykpJiZjKGIpfSxwPWZ1bmN0aW9uKGIsYyl7dmFyIGQ9Yi5vd25lckRvY3VtZW50O2EuYS5nLmdldChkLG0pfHwoYS5hLmcuc2V0KGQsbSwhMCksYS5hLkIoZCxcInNlbGVjdGlvbmNoYW5nZVwiLGwpKTthLmEuZy5zZXQoYixrLGMpfTthLmMudGV4dElucHV0PXtpbml0OmZ1bmN0aW9uKGIsYyxrKXtmdW5jdGlvbiBsKGMsZCl7YS5hLkIoYixjLGQpfWZ1bmN0aW9uIG0oKXt2YXIgZD1hLmEuZihjKCkpO2lmKG51bGw9PT1kfHxkPT09bilkPVwiXCI7TCE9PW4mJmQ9PT1MP2EuYS5zZXRUaW1lb3V0KG0sNCk6Yi52YWx1ZSE9PWQmJih5PSEwLGIudmFsdWU9ZCx5PSExLHY9Yi52YWx1ZSl9ZnVuY3Rpb24gcigpe3d8fChMPWIudmFsdWUsdz1hLmEuc2V0VGltZW91dCh6LFxuNCkpfWZ1bmN0aW9uIHooKXtjbGVhclRpbWVvdXQodyk7TD13PW47dmFyIGQ9Yi52YWx1ZTt2IT09ZCYmKHY9ZCxhLm0uZWIoYygpLGssXCJ0ZXh0SW5wdXRcIixkKSl9dmFyIHY9Yi52YWx1ZSx3LEwsQT05PT1hLmEuVz9yOnoseT0hMTtnJiZsKFwia2V5cHJlc3NcIix6KTsxMT5nJiZsKFwicHJvcGVydHljaGFuZ2VcIixmdW5jdGlvbihhKXt5fHxcInZhbHVlXCIhPT1hLnByb3BlcnR5TmFtZXx8QShhKX0pOzg9PWcmJihsKFwia2V5dXBcIix6KSxsKFwia2V5ZG93blwiLHopKTtwJiYocChiLEEpLGwoXCJkcmFnZW5kXCIscikpOyghZ3x8OTw9ZykmJmwoXCJpbnB1dFwiLEEpOzU+ZSYmXCJ0ZXh0YXJlYVwiPT09YS5hLlIoYik/KGwoXCJrZXlkb3duXCIsciksbChcInBhc3RlXCIsciksbChcImN1dFwiLHIpKToxMT5kP2woXCJrZXlkb3duXCIscik6ND5mPyhsKFwiRE9NQXV0b0NvbXBsZXRlXCIseiksbChcImRyYWdkcm9wXCIseiksbChcImRyb3BcIix6KSk6aCYmXCJudW1iZXJcIj09PWIudHlwZSYmbChcImtleWRvd25cIixyKTtsKFwiY2hhbmdlXCIsXG56KTtsKFwiYmx1clwiLHopO2EubyhtLG51bGwse2w6Yn0pfX07YS5tLndhLnRleHRJbnB1dD0hMDthLmMudGV4dGlucHV0PXtwcmVwcm9jZXNzOmZ1bmN0aW9uKGEsYixjKXtjKFwidGV4dElucHV0XCIsYSl9fX0pKCk7YS5jLnVuaXF1ZU5hbWU9e2luaXQ6ZnVuY3Rpb24oYixjKXtpZihjKCkpe3ZhciBkPVwia29fdW5pcXVlX1wiKyArK2EuYy51bmlxdWVOYW1lLnJkO2EuYS5ZYyhiLGQpfX19O2EuYy51bmlxdWVOYW1lLnJkPTA7YS5jLnVzaW5nPXtpbml0OmZ1bmN0aW9uKGIsYyxkLGUsZil7dmFyIGc7ZC5oYXMoXCJhc1wiKSYmKGc9e2FzOmQuZ2V0KFwiYXNcIiksbm9DaGlsZENvbnRleHQ6ZC5nZXQoXCJub0NoaWxkQ29udGV4dFwiKX0pO2M9Zi5jcmVhdGVDaGlsZENvbnRleHQoYyxnKTthLk9hKGMsYik7cmV0dXJue2NvbnRyb2xzRGVzY2VuZGFudEJpbmRpbmdzOiEwfX19O2EuaC5lYS51c2luZz0hMDthLmMudmFsdWU9e2luaXQ6ZnVuY3Rpb24oYixjLGQpe3ZhciBlPWEuYS5SKGIpLGY9XCJpbnB1dFwiPT1cbmU7aWYoIWZ8fFwiY2hlY2tib3hcIiE9Yi50eXBlJiZcInJhZGlvXCIhPWIudHlwZSl7dmFyIGc9W10saD1kLmdldChcInZhbHVlVXBkYXRlXCIpLG09ITEsaz1udWxsO2gmJihcInN0cmluZ1wiPT10eXBlb2YgaD9nPVtoXTpnPWEuYS53YyhoKSxhLmEuUGEoZyxcImNoYW5nZVwiKSk7dmFyIGw9ZnVuY3Rpb24oKXtrPW51bGw7bT0hMTt2YXIgZT1jKCksZj1hLncuTShiKTthLm0uZWIoZSxkLFwidmFsdWVcIixmKX07IWEuYS5XfHwhZnx8XCJ0ZXh0XCIhPWIudHlwZXx8XCJvZmZcIj09Yi5hdXRvY29tcGxldGV8fGIuZm9ybSYmXCJvZmZcIj09Yi5mb3JtLmF1dG9jb21wbGV0ZXx8LTEhPWEuYS5BKGcsXCJwcm9wZXJ0eWNoYW5nZVwiKXx8KGEuYS5CKGIsXCJwcm9wZXJ0eWNoYW5nZVwiLGZ1bmN0aW9uKCl7bT0hMH0pLGEuYS5CKGIsXCJmb2N1c1wiLGZ1bmN0aW9uKCl7bT0hMX0pLGEuYS5CKGIsXCJibHVyXCIsZnVuY3Rpb24oKXttJiZsKCl9KSk7YS5hLkQoZyxmdW5jdGlvbihjKXt2YXIgZD1sO2EuYS5VZChjLFwiYWZ0ZXJcIikmJlxuKGQ9ZnVuY3Rpb24oKXtrPWEudy5NKGIpO2EuYS5zZXRUaW1lb3V0KGwsMCl9LGM9Yy5zdWJzdHJpbmcoNSkpO2EuYS5CKGIsYyxkKX0pO3ZhciBwO3A9ZiYmXCJmaWxlXCI9PWIudHlwZT9mdW5jdGlvbigpe3ZhciBkPWEuYS5mKGMoKSk7bnVsbD09PWR8fGQ9PT1ufHxcIlwiPT09ZD9iLnZhbHVlPVwiXCI6YS51LkcobCl9OmZ1bmN0aW9uKCl7dmFyIGY9YS5hLmYoYygpKSxnPWEudy5NKGIpO2lmKG51bGwhPT1rJiZmPT09aylhLmEuc2V0VGltZW91dChwLDApO2Vsc2UgaWYoZiE9PWd8fGc9PT1uKVwic2VsZWN0XCI9PT1lPyhnPWQuZ2V0KFwidmFsdWVBbGxvd1Vuc2V0XCIpLGEudy5jYihiLGYsZyksZ3x8Zj09PWEudy5NKGIpfHxhLnUuRyhsKSk6YS53LmNiKGIsZil9O2lmKFwic2VsZWN0XCI9PT1lKXt2YXIgcTthLmkuc3Vic2NyaWJlKGIsYS5pLkgsZnVuY3Rpb24oKXtxP2QuZ2V0KFwidmFsdWVBbGxvd1Vuc2V0XCIpP3AoKTpsKCk6KGEuYS5CKGIsXCJjaGFuZ2VcIixsKSxxPWEubyhwLG51bGwse2w6Yn0pKX0sXG5udWxsLHtub3RpZnlJbW1lZGlhdGVseTohMH0pfWVsc2UgYS5hLkIoYixcImNoYW5nZVwiLGwpLGEubyhwLG51bGwse2w6Yn0pfWVsc2UgYS5pYihiLHtjaGVja2VkVmFsdWU6Y30pfSx1cGRhdGU6ZnVuY3Rpb24oKXt9fTthLm0ud2EudmFsdWU9ITA7YS5jLnZpc2libGU9e3VwZGF0ZTpmdW5jdGlvbihiLGMpe3ZhciBkPWEuYS5mKGMoKSksZT1cIm5vbmVcIiE9Yi5zdHlsZS5kaXNwbGF5O2QmJiFlP2Iuc3R5bGUuZGlzcGxheT1cIlwiOiFkJiZlJiYoYi5zdHlsZS5kaXNwbGF5PVwibm9uZVwiKX19O2EuYy5oaWRkZW49e3VwZGF0ZTpmdW5jdGlvbihiLGMpe2EuYy52aXNpYmxlLnVwZGF0ZShiLGZ1bmN0aW9uKCl7cmV0dXJuIWEuYS5mKGMoKSl9KX19OyhmdW5jdGlvbihiKXthLmNbYl09e2luaXQ6ZnVuY3Rpb24oYyxkLGUsZixnKXtyZXR1cm4gYS5jLmV2ZW50LmluaXQuY2FsbCh0aGlzLGMsZnVuY3Rpb24oKXt2YXIgYT17fTthW2JdPWQoKTtyZXR1cm4gYX0sZSxmLGcpfX19KShcImNsaWNrXCIpO1xuYS5jYT1mdW5jdGlvbigpe307YS5jYS5wcm90b3R5cGUucmVuZGVyVGVtcGxhdGVTb3VyY2U9ZnVuY3Rpb24oKXt0aHJvdyBFcnJvcihcIk92ZXJyaWRlIHJlbmRlclRlbXBsYXRlU291cmNlXCIpO307YS5jYS5wcm90b3R5cGUuY3JlYXRlSmF2YVNjcmlwdEV2YWx1YXRvckJsb2NrPWZ1bmN0aW9uKCl7dGhyb3cgRXJyb3IoXCJPdmVycmlkZSBjcmVhdGVKYXZhU2NyaXB0RXZhbHVhdG9yQmxvY2tcIik7fTthLmNhLnByb3RvdHlwZS5tYWtlVGVtcGxhdGVTb3VyY2U9ZnVuY3Rpb24oYixjKXtpZihcInN0cmluZ1wiPT10eXBlb2YgYil7Yz1jfHx3O3ZhciBkPWMuZ2V0RWxlbWVudEJ5SWQoYik7aWYoIWQpdGhyb3cgRXJyb3IoXCJDYW5ub3QgZmluZCB0ZW1wbGF0ZSB3aXRoIElEIFwiK2IpO3JldHVybiBuZXcgYS5DLkYoZCl9aWYoMT09Yi5ub2RlVHlwZXx8OD09Yi5ub2RlVHlwZSlyZXR1cm4gbmV3IGEuQy5pYShiKTt0aHJvdyBFcnJvcihcIlVua25vd24gdGVtcGxhdGUgdHlwZTogXCIrYik7fTthLmNhLnByb3RvdHlwZS5yZW5kZXJUZW1wbGF0ZT1cbmZ1bmN0aW9uKGEsYyxkLGUpe2E9dGhpcy5tYWtlVGVtcGxhdGVTb3VyY2UoYSxlKTtyZXR1cm4gdGhpcy5yZW5kZXJUZW1wbGF0ZVNvdXJjZShhLGMsZCxlKX07YS5jYS5wcm90b3R5cGUuaXNUZW1wbGF0ZVJld3JpdHRlbj1mdW5jdGlvbihhLGMpe3JldHVybiExPT09dGhpcy5hbGxvd1RlbXBsYXRlUmV3cml0aW5nPyEwOnRoaXMubWFrZVRlbXBsYXRlU291cmNlKGEsYykuZGF0YShcImlzUmV3cml0dGVuXCIpfTthLmNhLnByb3RvdHlwZS5yZXdyaXRlVGVtcGxhdGU9ZnVuY3Rpb24oYSxjLGQpe2E9dGhpcy5tYWtlVGVtcGxhdGVTb3VyY2UoYSxkKTtjPWMoYS50ZXh0KCkpO2EudGV4dChjKTthLmRhdGEoXCJpc1Jld3JpdHRlblwiLCEwKX07YS5iKFwidGVtcGxhdGVFbmdpbmVcIixhLmNhKTthLmtjPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYihiLGMsZCxoKXtiPWEubS5hYyhiKTtmb3IodmFyIG09YS5tLlJhLGs9MDtrPGIubGVuZ3RoO2srKyl7dmFyIGw9YltrXS5rZXk7aWYoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG0sXG5sKSl7dmFyIHA9bVtsXTtpZihcImZ1bmN0aW9uXCI9PT10eXBlb2YgcCl7aWYobD1wKGJba10udmFsdWUpKXRocm93IEVycm9yKGwpO31lbHNlIGlmKCFwKXRocm93IEVycm9yKFwiVGhpcyB0ZW1wbGF0ZSBlbmdpbmUgZG9lcyBub3Qgc3VwcG9ydCB0aGUgJ1wiK2wrXCInIGJpbmRpbmcgd2l0aGluIGl0cyB0ZW1wbGF0ZXNcIik7fX1kPVwia28uX190cl9hbWJ0bnMoZnVuY3Rpb24oJGNvbnRleHQsJGVsZW1lbnQpe3JldHVybihmdW5jdGlvbigpe3JldHVybnsgXCIrYS5tLnZiKGIse3ZhbHVlQWNjZXNzb3JzOiEwfSkrXCIgfSB9KSgpfSwnXCIrZC50b0xvd2VyQ2FzZSgpK1wiJylcIjtyZXR1cm4gaC5jcmVhdGVKYXZhU2NyaXB0RXZhbHVhdG9yQmxvY2soZCkrY312YXIgYz0vKDwoW2Etel0rXFxkKikoPzpcXHMrKD8hZGF0YS1iaW5kXFxzKj1cXHMqKVthLXowLTlcXC1dKyg/Oj0oPzpcXFwiW15cXFwiXSpcXFwifFxcJ1teXFwnXSpcXCd8W14+XSopKT8pKlxccyspZGF0YS1iaW5kXFxzKj1cXHMqKFtcIiddKShbXFxzXFxTXSo/KVxcMy9naSxcbmQ9L1xceDNjIS0tXFxzKmtvXFxiXFxzKihbXFxzXFxTXSo/KVxccyotLVxceDNlL2c7cmV0dXJue3hkOmZ1bmN0aW9uKGIsYyxkKXtjLmlzVGVtcGxhdGVSZXdyaXR0ZW4oYixkKXx8Yy5yZXdyaXRlVGVtcGxhdGUoYixmdW5jdGlvbihiKXtyZXR1cm4gYS5rYy5MZChiLGMpfSxkKX0sTGQ6ZnVuY3Rpb24oYSxmKXtyZXR1cm4gYS5yZXBsYWNlKGMsZnVuY3Rpb24oYSxjLGQsZSxsKXtyZXR1cm4gYihsLGMsZCxmKX0pLnJlcGxhY2UoZCxmdW5jdGlvbihhLGMpe3JldHVybiBiKGMsXCJcXHgzYyEtLSBrbyAtLVxceDNlXCIsXCIjY29tbWVudFwiLGYpfSl9LG1kOmZ1bmN0aW9uKGIsYyl7cmV0dXJuIGEuYWEuWGIoZnVuY3Rpb24oZCxoKXt2YXIgbT1kLm5leHRTaWJsaW5nO20mJm0ubm9kZU5hbWUudG9Mb3dlckNhc2UoKT09PWMmJmEuaWIobSxiLGgpfSl9fX0oKTthLmIoXCJfX3RyX2FtYnRuc1wiLGEua2MubWQpOyhmdW5jdGlvbigpe2EuQz17fTthLkMuRj1mdW5jdGlvbihiKXtpZih0aGlzLkY9Yil7dmFyIGM9XG5hLmEuUihiKTt0aGlzLmFiPVwic2NyaXB0XCI9PT1jPzE6XCJ0ZXh0YXJlYVwiPT09Yz8yOlwidGVtcGxhdGVcIj09YyYmYi5jb250ZW50JiYxMT09PWIuY29udGVudC5ub2RlVHlwZT8zOjR9fTthLkMuRi5wcm90b3R5cGUudGV4dD1mdW5jdGlvbigpe3ZhciBiPTE9PT10aGlzLmFiP1widGV4dFwiOjI9PT10aGlzLmFiP1widmFsdWVcIjpcImlubmVySFRNTFwiO2lmKDA9PWFyZ3VtZW50cy5sZW5ndGgpcmV0dXJuIHRoaXMuRltiXTt2YXIgYz1hcmd1bWVudHNbMF07XCJpbm5lckhUTUxcIj09PWI/YS5hLmZjKHRoaXMuRixjKTp0aGlzLkZbYl09Y307dmFyIGI9YS5hLmcuWigpK1wiX1wiO2EuQy5GLnByb3RvdHlwZS5kYXRhPWZ1bmN0aW9uKGMpe2lmKDE9PT1hcmd1bWVudHMubGVuZ3RoKXJldHVybiBhLmEuZy5nZXQodGhpcy5GLGIrYyk7YS5hLmcuc2V0KHRoaXMuRixiK2MsYXJndW1lbnRzWzFdKX07dmFyIGM9YS5hLmcuWigpO2EuQy5GLnByb3RvdHlwZS5ub2Rlcz1mdW5jdGlvbigpe3ZhciBiPXRoaXMuRjtcbmlmKDA9PWFyZ3VtZW50cy5sZW5ndGgpe3ZhciBlPWEuYS5nLmdldChiLGMpfHx7fSxmPWUubGJ8fCgzPT09dGhpcy5hYj9iLmNvbnRlbnQ6ND09PXRoaXMuYWI/YjpuKTtpZighZnx8ZS5qZCl7dmFyIGc9dGhpcy50ZXh0KCk7ZyYmZyE9PWUuYmImJihmPWEuYS5NZChnLGIub3duZXJEb2N1bWVudCksYS5hLmcuc2V0KGIsYyx7bGI6ZixiYjpnLGpkOiEwfSkpfXJldHVybiBmfWU9YXJndW1lbnRzWzBdO3RoaXMuYWIhPT1uJiZ0aGlzLnRleHQoXCJcIik7YS5hLmcuc2V0KGIsYyx7bGI6ZX0pfTthLkMuaWE9ZnVuY3Rpb24oYSl7dGhpcy5GPWF9O2EuQy5pYS5wcm90b3R5cGU9bmV3IGEuQy5GO2EuQy5pYS5wcm90b3R5cGUuY29uc3RydWN0b3I9YS5DLmlhO2EuQy5pYS5wcm90b3R5cGUudGV4dD1mdW5jdGlvbigpe2lmKDA9PWFyZ3VtZW50cy5sZW5ndGgpe3ZhciBiPWEuYS5nLmdldCh0aGlzLkYsYyl8fHt9O2IuYmI9PT1uJiZiLmxiJiYoYi5iYj1iLmxiLmlubmVySFRNTCk7cmV0dXJuIGIuYmJ9YS5hLmcuc2V0KHRoaXMuRixcbmMse2JiOmFyZ3VtZW50c1swXX0pfTthLmIoXCJ0ZW1wbGF0ZVNvdXJjZXNcIixhLkMpO2EuYihcInRlbXBsYXRlU291cmNlcy5kb21FbGVtZW50XCIsYS5DLkYpO2EuYihcInRlbXBsYXRlU291cmNlcy5hbm9ueW1vdXNUZW1wbGF0ZVwiLGEuQy5pYSl9KSgpOyhmdW5jdGlvbigpe2Z1bmN0aW9uIGIoYixjLGQpe3ZhciBlO2ZvcihjPWEuaC5uZXh0U2libGluZyhjKTtiJiYoZT1iKSE9PWM7KWI9YS5oLm5leHRTaWJsaW5nKGUpLGQoZSxiKX1mdW5jdGlvbiBjKGMsZCl7aWYoYy5sZW5ndGgpe3ZhciBlPWNbMF0sZj1jW2MubGVuZ3RoLTFdLGc9ZS5wYXJlbnROb2RlLGg9YS5nYS5pbnN0YW5jZSxtPWgucHJlcHJvY2Vzc05vZGU7aWYobSl7YihlLGYsZnVuY3Rpb24oYSxiKXt2YXIgYz1hLnByZXZpb3VzU2libGluZyxkPW0uY2FsbChoLGEpO2QmJihhPT09ZSYmKGU9ZFswXXx8YiksYT09PWYmJihmPWRbZC5sZW5ndGgtMV18fGMpKX0pO2MubGVuZ3RoPTA7aWYoIWUpcmV0dXJuO2U9PT1mP2MucHVzaChlKTpcbihjLnB1c2goZSxmKSxhLmEuVWEoYyxnKSl9YihlLGYsZnVuY3Rpb24oYil7MSE9PWIubm9kZVR5cGUmJjghPT1iLm5vZGVUeXBlfHxhLnZjKGQsYil9KTtiKGUsZixmdW5jdGlvbihiKXsxIT09Yi5ub2RlVHlwZSYmOCE9PWIubm9kZVR5cGV8fGEuYWEuY2QoYixbZF0pfSk7YS5hLlVhKGMsZyl9fWZ1bmN0aW9uIGQoYSl7cmV0dXJuIGEubm9kZVR5cGU/YTowPGEubGVuZ3RoP2FbMF06bnVsbH1mdW5jdGlvbiBlKGIsZSxmLGgsbSl7bT1tfHx7fTt2YXIgbj0oYiYmZChiKXx8Znx8e30pLm93bmVyRG9jdW1lbnQsQj1tLnRlbXBsYXRlRW5naW5lfHxnO2Eua2MueGQoZixCLG4pO2Y9Qi5yZW5kZXJUZW1wbGF0ZShmLGgsbSxuKTtpZihcIm51bWJlclwiIT10eXBlb2YgZi5sZW5ndGh8fDA8Zi5sZW5ndGgmJlwibnVtYmVyXCIhPXR5cGVvZiBmWzBdLm5vZGVUeXBlKXRocm93IEVycm9yKFwiVGVtcGxhdGUgZW5naW5lIG11c3QgcmV0dXJuIGFuIGFycmF5IG9mIERPTSBub2Rlc1wiKTtuPSExO3N3aXRjaChlKXtjYXNlIFwicmVwbGFjZUNoaWxkcmVuXCI6YS5oLnZhKGIsXG5mKTtuPSEwO2JyZWFrO2Nhc2UgXCJyZXBsYWNlTm9kZVwiOmEuYS5YYyhiLGYpO249ITA7YnJlYWs7Y2FzZSBcImlnbm9yZVRhcmdldE5vZGVcIjpicmVhaztkZWZhdWx0OnRocm93IEVycm9yKFwiVW5rbm93biByZW5kZXJNb2RlOiBcIitlKTt9biYmKGMoZixoKSxtLmFmdGVyUmVuZGVyJiZhLnUuRyhtLmFmdGVyUmVuZGVyLG51bGwsW2YsaFttLmFzfHxcIiRkYXRhXCJdXSksXCJyZXBsYWNlQ2hpbGRyZW5cIj09ZSYmYS5pLm1hKGIsYS5pLkgpKTtyZXR1cm4gZn1mdW5jdGlvbiBmKGIsYyxkKXtyZXR1cm4gYS5PKGIpP2IoKTpcImZ1bmN0aW9uXCI9PT10eXBlb2YgYj9iKGMsZCk6Yn12YXIgZzthLmdjPWZ1bmN0aW9uKGIpe2lmKGIhPW4mJiEoYiBpbnN0YW5jZW9mIGEuY2EpKXRocm93IEVycm9yKFwidGVtcGxhdGVFbmdpbmUgbXVzdCBpbmhlcml0IGZyb20ga28udGVtcGxhdGVFbmdpbmVcIik7Zz1ifTthLmRjPWZ1bmN0aW9uKGIsYyxoLG0sdCl7aD1ofHx7fTtpZigoaC50ZW1wbGF0ZUVuZ2luZXx8Zyk9PVxubil0aHJvdyBFcnJvcihcIlNldCBhIHRlbXBsYXRlIGVuZ2luZSBiZWZvcmUgY2FsbGluZyByZW5kZXJUZW1wbGF0ZVwiKTt0PXR8fFwicmVwbGFjZUNoaWxkcmVuXCI7aWYobSl7dmFyIHg9ZChtKTtyZXR1cm4gYS4kKGZ1bmN0aW9uKCl7dmFyIGc9YyYmYyBpbnN0YW5jZW9mIGEuZmE/YzpuZXcgYS5mYShjLG51bGwsbnVsbCxudWxsLHtleHBvcnREZXBlbmRlbmNpZXM6ITB9KSxuPWYoYixnLiRkYXRhLGcpLGc9ZShtLHQsbixnLGgpO1wicmVwbGFjZU5vZGVcIj09dCYmKG09Zyx4PWQobSkpfSxudWxsLHtTYTpmdW5jdGlvbigpe3JldHVybiF4fHwhYS5hLlNiKHgpfSxsOngmJlwicmVwbGFjZU5vZGVcIj09dD94LnBhcmVudE5vZGU6eH0pfXJldHVybiBhLmFhLlhiKGZ1bmN0aW9uKGQpe2EuZGMoYixjLGgsZCxcInJlcGxhY2VOb2RlXCIpfSl9O2EuUWQ9ZnVuY3Rpb24oYixkLGcsaCxtKXtmdW5jdGlvbiB4KGIsYyl7YS51LkcoYS5hLmVjLG51bGwsW2gsYix1LGcscixjXSk7YS5pLm1hKGgsYS5pLkgpfVxuZnVuY3Rpb24gcihhLGIpe2MoYix2KTtnLmFmdGVyUmVuZGVyJiZnLmFmdGVyUmVuZGVyKGIsYSk7dj1udWxsfWZ1bmN0aW9uIHUoYSxjKXt2PW0uY3JlYXRlQ2hpbGRDb250ZXh0KGEse2FzOnosbm9DaGlsZENvbnRleHQ6Zy5ub0NoaWxkQ29udGV4dCxleHRlbmQ6ZnVuY3Rpb24oYSl7YS4kaW5kZXg9Yzt6JiYoYVt6K1wiSW5kZXhcIl09Yyl9fSk7dmFyIGQ9ZihiLGEsdik7cmV0dXJuIGUoaCxcImlnbm9yZVRhcmdldE5vZGVcIixkLHYsZyl9dmFyIHYsej1nLmFzLHc9ITE9PT1nLmluY2x1ZGVEZXN0cm95ZWR8fGEub3B0aW9ucy5mb3JlYWNoSGlkZXNEZXN0cm95ZWQmJiFnLmluY2x1ZGVEZXN0cm95ZWQ7aWYod3x8Zy5iZWZvcmVSZW1vdmV8fCFhLlBjKGQpKXJldHVybiBhLiQoZnVuY3Rpb24oKXt2YXIgYj1hLmEuZihkKXx8W107XCJ1bmRlZmluZWRcIj09dHlwZW9mIGIubGVuZ3RoJiYoYj1bYl0pO3cmJihiPWEuYS5qYihiLGZ1bmN0aW9uKGIpe3JldHVybiBiPT09bnx8bnVsbD09PWJ8fFxuIWEuYS5mKGIuX2Rlc3Ryb3kpfSkpO3goYil9LG51bGwse2w6aH0pO3goZC52KCkpO3ZhciBBPWQuc3Vic2NyaWJlKGZ1bmN0aW9uKGEpe3goZCgpLGEpfSxudWxsLFwiYXJyYXlDaGFuZ2VcIik7QS5sKGgpO3JldHVybiBBfTt2YXIgaD1hLmEuZy5aKCksbT1hLmEuZy5aKCk7YS5jLnRlbXBsYXRlPXtpbml0OmZ1bmN0aW9uKGIsYyl7dmFyIGQ9YS5hLmYoYygpKTtpZihcInN0cmluZ1wiPT10eXBlb2YgZHx8XCJuYW1lXCJpbiBkKWEuaC5FYShiKTtlbHNlIGlmKFwibm9kZXNcImluIGQpe2Q9ZC5ub2Rlc3x8W107aWYoYS5PKGQpKXRocm93IEVycm9yKCdUaGUgXCJub2Rlc1wiIG9wdGlvbiBtdXN0IGJlIGEgcGxhaW4sIG5vbi1vYnNlcnZhYmxlIGFycmF5LicpO3ZhciBlPWRbMF0mJmRbMF0ucGFyZW50Tm9kZTtlJiZhLmEuZy5nZXQoZSxtKXx8KGU9YS5hLlliKGQpLGEuYS5nLnNldChlLG0sITApKTsobmV3IGEuQy5pYShiKSkubm9kZXMoZSl9ZWxzZSBpZihkPWEuaC5jaGlsZE5vZGVzKGIpLDA8ZC5sZW5ndGgpZT1cbmEuYS5ZYihkKSwobmV3IGEuQy5pYShiKSkubm9kZXMoZSk7ZWxzZSB0aHJvdyBFcnJvcihcIkFub255bW91cyB0ZW1wbGF0ZSBkZWZpbmVkLCBidXQgbm8gdGVtcGxhdGUgY29udGVudCB3YXMgcHJvdmlkZWRcIik7cmV0dXJue2NvbnRyb2xzRGVzY2VuZGFudEJpbmRpbmdzOiEwfX0sdXBkYXRlOmZ1bmN0aW9uKGIsYyxkLGUsZil7dmFyIGc9YygpO2M9YS5hLmYoZyk7ZD0hMDtlPW51bGw7XCJzdHJpbmdcIj09dHlwZW9mIGM/Yz17fTooZz1cIm5hbWVcImluIGM/Yy5uYW1lOmIsXCJpZlwiaW4gYyYmKGQ9YS5hLmYoY1tcImlmXCJdKSksZCYmXCJpZm5vdFwiaW4gYyYmKGQ9IWEuYS5mKGMuaWZub3QpKSxkJiYhZyYmKGQ9ITEpKTtcImZvcmVhY2hcImluIGM/ZT1hLlFkKGcsZCYmYy5mb3JlYWNofHxbXSxjLGIsZik6ZD8oZD1mLFwiZGF0YVwiaW4gYyYmKGQ9Zi5jcmVhdGVDaGlsZENvbnRleHQoYy5kYXRhLHthczpjLmFzLG5vQ2hpbGRDb250ZXh0OmMubm9DaGlsZENvbnRleHQsZXhwb3J0RGVwZW5kZW5jaWVzOiEwfSkpLFxuZT1hLmRjKGcsZCxjLGIpKTphLmguRWEoYik7Zj1lOyhjPWEuYS5nLmdldChiLGgpKSYmXCJmdW5jdGlvblwiPT10eXBlb2YgYy5zJiZjLnMoKTthLmEuZy5zZXQoYixoLCFmfHxmLmphJiYhZi5qYSgpP246Zil9fTthLm0uUmEudGVtcGxhdGU9ZnVuY3Rpb24oYil7Yj1hLm0uYWMoYik7cmV0dXJuIDE9PWIubGVuZ3RoJiZiWzBdLnVua25vd258fGEubS5JZChiLFwibmFtZVwiKT9udWxsOlwiVGhpcyB0ZW1wbGF0ZSBlbmdpbmUgZG9lcyBub3Qgc3VwcG9ydCBhbm9ueW1vdXMgdGVtcGxhdGVzIG5lc3RlZCB3aXRoaW4gaXRzIHRlbXBsYXRlc1wifTthLmguZWEudGVtcGxhdGU9ITB9KSgpO2EuYihcInNldFRlbXBsYXRlRW5naW5lXCIsYS5nYyk7YS5iKFwicmVuZGVyVGVtcGxhdGVcIixhLmRjKTthLmEuS2M9ZnVuY3Rpb24oYSxjLGQpe2lmKGEubGVuZ3RoJiZjLmxlbmd0aCl7dmFyIGUsZixnLGgsbTtmb3IoZT1mPTA7KCFkfHxlPGQpJiYoaD1hW2ZdKTsrK2Ype2ZvcihnPTA7bT1jW2ddOysrZylpZihoLnZhbHVlPT09XG5tLnZhbHVlKXtoLm1vdmVkPW0uaW5kZXg7bS5tb3ZlZD1oLmluZGV4O2Muc3BsaWNlKGcsMSk7ZT1nPTA7YnJlYWt9ZSs9Z319fTthLmEuUGI9ZnVuY3Rpb24oKXtmdW5jdGlvbiBiKGIsZCxlLGYsZyl7dmFyIGg9TWF0aC5taW4sbT1NYXRoLm1heCxrPVtdLGwscD1iLmxlbmd0aCxxLG49ZC5sZW5ndGgscj1uLXB8fDEsdj1wK24rMSx1LHcsejtmb3IobD0wO2w8PXA7bCsrKWZvcih3PXUsay5wdXNoKHU9W10pLHo9aChuLGwrcikscT1tKDAsbC0xKTtxPD16O3ErKyl1W3FdPXE/bD9iW2wtMV09PT1kW3EtMV0/d1txLTFdOmgod1txXXx8dix1W3EtMV18fHYpKzE6cSsxOmwrMTtoPVtdO209W107cj1bXTtsPXA7Zm9yKHE9bjtsfHxxOyluPWtbbF1bcV0tMSxxJiZuPT09a1tsXVtxLTFdP20ucHVzaChoW2gubGVuZ3RoXT17c3RhdHVzOmUsdmFsdWU6ZFstLXFdLGluZGV4OnF9KTpsJiZuPT09a1tsLTFdW3FdP3IucHVzaChoW2gubGVuZ3RoXT17c3RhdHVzOmYsdmFsdWU6YlstLWxdLGluZGV4Omx9KTpcbigtLXEsLS1sLGcuc3BhcnNlfHxoLnB1c2goe3N0YXR1czpcInJldGFpbmVkXCIsdmFsdWU6ZFtxXX0pKTthLmEuS2MocixtLCFnLmRvbnRMaW1pdE1vdmVzJiYxMCpwKTtyZXR1cm4gaC5yZXZlcnNlKCl9cmV0dXJuIGZ1bmN0aW9uKGEsZCxlKXtlPVwiYm9vbGVhblwiPT09dHlwZW9mIGU/e2RvbnRMaW1pdE1vdmVzOmV9OmV8fHt9O2E9YXx8W107ZD1kfHxbXTtyZXR1cm4gYS5sZW5ndGg8ZC5sZW5ndGg/YihhLGQsXCJhZGRlZFwiLFwiZGVsZXRlZFwiLGUpOmIoZCxhLFwiZGVsZXRlZFwiLFwiYWRkZWRcIixlKX19KCk7YS5iKFwidXRpbHMuY29tcGFyZUFycmF5c1wiLGEuYS5QYik7KGZ1bmN0aW9uKCl7ZnVuY3Rpb24gYihiLGMsZCxoLG0pe3ZhciBrPVtdLGw9YS4kKGZ1bmN0aW9uKCl7dmFyIGw9YyhkLG0sYS5hLlVhKGssYikpfHxbXTswPGsubGVuZ3RoJiYoYS5hLlhjKGssbCksaCYmYS51LkcoaCxudWxsLFtkLGwsbV0pKTtrLmxlbmd0aD0wO2EuYS5OYihrLGwpfSxudWxsLHtsOmIsU2E6ZnVuY3Rpb24oKXtyZXR1cm4hYS5hLmtkKGspfX0pO1xucmV0dXJue1k6aywkOmwuamEoKT9sOm59fXZhciBjPWEuYS5nLlooKSxkPWEuYS5nLlooKTthLmEuZWM9ZnVuY3Rpb24oZSxmLGcsaCxtLGspe2Z1bmN0aW9uIGwoYil7eT17QWE6YixwYjphLnRhKHcrKyl9O3YucHVzaCh5KTtyfHxGLnB1c2goeSl9ZnVuY3Rpb24gcChiKXt5PXRbYl07dyE9PXkucGIudigpJiZELnB1c2goeSk7eS5wYih3KyspO2EuYS5VYSh5LlksZSk7di5wdXNoKHkpfWZ1bmN0aW9uIHEoYixjKXtpZihiKWZvcih2YXIgZD0wLGU9Yy5sZW5ndGg7ZDxlO2QrKylhLmEuRChjW2RdLlksZnVuY3Rpb24oYSl7YihhLGQsY1tkXS5BYSl9KX1mPWZ8fFtdO1widW5kZWZpbmVkXCI9PXR5cGVvZiBmLmxlbmd0aCYmKGY9W2ZdKTtoPWh8fHt9O3ZhciB0PWEuYS5nLmdldChlLGMpLHI9IXQsdj1bXSx1PTAsdz0wLHo9W10sQT1bXSxDPVtdLEQ9W10sRj1bXSx5LEk9MDtpZihyKWEuYS5EKGYsbCk7ZWxzZXtpZigha3x8dCYmdC5fY291bnRXYWl0aW5nRm9yUmVtb3ZlKXt2YXIgRT1cbmEuYS5NYih0LGZ1bmN0aW9uKGEpe3JldHVybiBhLkFhfSk7az1hLmEuUGIoRSxmLHtkb250TGltaXRNb3ZlczpoLmRvbnRMaW1pdE1vdmVzLHNwYXJzZTohMH0pfWZvcih2YXIgRT0wLEcsSCxLO0c9a1tFXTtFKyspc3dpdGNoKEg9Ry5tb3ZlZCxLPUcuaW5kZXgsRy5zdGF0dXMpe2Nhc2UgXCJkZWxldGVkXCI6Zm9yKDt1PEs7KXAodSsrKTtIPT09biYmKHk9dFt1XSx5LiQmJih5LiQucygpLHkuJD1uKSxhLmEuVWEoeS5ZLGUpLmxlbmd0aCYmKGguYmVmb3JlUmVtb3ZlJiYodi5wdXNoKHkpLEkrKyx5LkFhPT09ZD95PW51bGw6Qy5wdXNoKHkpKSx5JiZ6LnB1c2guYXBwbHkoeix5LlkpKSk7dSsrO2JyZWFrO2Nhc2UgXCJhZGRlZFwiOmZvcig7dzxLOylwKHUrKyk7SCE9PW4/KEEucHVzaCh2Lmxlbmd0aCkscChIKSk6bChHLnZhbHVlKX1mb3IoO3c8Zi5sZW5ndGg7KXAodSsrKTt2Ll9jb3VudFdhaXRpbmdGb3JSZW1vdmU9SX1hLmEuZy5zZXQoZSxjLHYpO3EoaC5iZWZvcmVNb3ZlLEQpO2EuYS5EKHosXG5oLmJlZm9yZVJlbW92ZT9hLm9hOmEucmVtb3ZlTm9kZSk7dmFyIE0sTyxQO3RyeXtQPWUub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50fWNhdGNoKE4pe31pZihBLmxlbmd0aClmb3IoOyhFPUEuc2hpZnQoKSkhPW47KXt5PXZbRV07Zm9yKE09bjtFOylpZigoTz12Wy0tRV0uWSkmJk8ubGVuZ3RoKXtNPU9bTy5sZW5ndGgtMV07YnJlYWt9Zm9yKGY9MDt1PXkuWVtmXTtNPXUsZisrKWEuaC5XYihlLHUsTSl9Zm9yKEU9MDt5PXZbRV07RSsrKXt5Lll8fGEuYS5leHRlbmQoeSxiKGUsZyx5LkFhLG0seS5wYikpO2ZvcihmPTA7dT15LllbZl07TT11LGYrKylhLmguV2IoZSx1LE0pOyF5LkVkJiZtJiYobSh5LkFhLHkuWSx5LnBiKSx5LkVkPSEwLE09eS5ZW3kuWS5sZW5ndGgtMV0pfVAmJmUub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50IT1QJiZQLmZvY3VzKCk7cShoLmJlZm9yZVJlbW92ZSxDKTtmb3IoRT0wO0U8Qy5sZW5ndGg7KytFKUNbRV0uQWE9ZDtxKGguYWZ0ZXJNb3ZlLEQpO1xucShoLmFmdGVyQWRkLEYpfX0pKCk7YS5iKFwidXRpbHMuc2V0RG9tTm9kZUNoaWxkcmVuRnJvbUFycmF5TWFwcGluZ1wiLGEuYS5lYyk7YS5iYT1mdW5jdGlvbigpe3RoaXMuYWxsb3dUZW1wbGF0ZVJld3JpdGluZz0hMX07YS5iYS5wcm90b3R5cGU9bmV3IGEuY2E7YS5iYS5wcm90b3R5cGUuY29uc3RydWN0b3I9YS5iYTthLmJhLnByb3RvdHlwZS5yZW5kZXJUZW1wbGF0ZVNvdXJjZT1mdW5jdGlvbihiLGMsZCxlKXtpZihjPSg5PmEuYS5XPzA6Yi5ub2Rlcyk/Yi5ub2RlcygpOm51bGwpcmV0dXJuIGEuYS5sYShjLmNsb25lTm9kZSghMCkuY2hpbGROb2Rlcyk7Yj1iLnRleHQoKTtyZXR1cm4gYS5hLnVhKGIsZSl9O2EuYmEuTWE9bmV3IGEuYmE7YS5nYyhhLmJhLk1hKTthLmIoXCJuYXRpdmVUZW1wbGF0ZUVuZ2luZVwiLGEuYmEpOyhmdW5jdGlvbigpe2EuJGE9ZnVuY3Rpb24oKXt2YXIgYT10aGlzLkhkPWZ1bmN0aW9uKCl7aWYoIXZ8fCF2LnRtcGwpcmV0dXJuIDA7dHJ5e2lmKDA8PXYudG1wbC50YWcudG1wbC5vcGVuLnRvU3RyaW5nKCkuaW5kZXhPZihcIl9fXCIpKXJldHVybiAyfWNhdGNoKGEpe31yZXR1cm4gMX0oKTtcbnRoaXMucmVuZGVyVGVtcGxhdGVTb3VyY2U9ZnVuY3Rpb24oYixlLGYsZyl7Zz1nfHx3O2Y9Znx8e307aWYoMj5hKXRocm93IEVycm9yKFwiWW91ciB2ZXJzaW9uIG9mIGpRdWVyeS50bXBsIGlzIHRvbyBvbGQuIFBsZWFzZSB1cGdyYWRlIHRvIGpRdWVyeS50bXBsIDEuMC4wcHJlIG9yIGxhdGVyLlwiKTt2YXIgaD1iLmRhdGEoXCJwcmVjb21waWxlZFwiKTtofHwoaD1iLnRleHQoKXx8XCJcIixoPXYudGVtcGxhdGUobnVsbCxcInt7a29fd2l0aCAkaXRlbS5rb0JpbmRpbmdDb250ZXh0fX1cIitoK1wie3sva29fd2l0aH19XCIpLGIuZGF0YShcInByZWNvbXBpbGVkXCIsaCkpO2I9W2UuJGRhdGFdO2U9di5leHRlbmQoe2tvQmluZGluZ0NvbnRleHQ6ZX0sZi50ZW1wbGF0ZU9wdGlvbnMpO2U9di50bXBsKGgsYixlKTtlLmFwcGVuZFRvKGcuY3JlYXRlRWxlbWVudChcImRpdlwiKSk7di5mcmFnbWVudHM9e307cmV0dXJuIGV9O3RoaXMuY3JlYXRlSmF2YVNjcmlwdEV2YWx1YXRvckJsb2NrPWZ1bmN0aW9uKGEpe3JldHVyblwie3trb19jb2RlICgoZnVuY3Rpb24oKSB7IHJldHVybiBcIitcbmErXCIgfSkoKSkgfX1cIn07dGhpcy5hZGRUZW1wbGF0ZT1mdW5jdGlvbihhLGIpe3cud3JpdGUoXCI8c2NyaXB0IHR5cGU9J3RleHQvaHRtbCcgaWQ9J1wiK2ErXCInPlwiK2IrXCJcXHgzYy9zY3JpcHQ+XCIpfTswPGEmJih2LnRtcGwudGFnLmtvX2NvZGU9e29wZW46XCJfXy5wdXNoKCQxIHx8ICcnKTtcIn0sdi50bXBsLnRhZy5rb193aXRoPXtvcGVuOlwid2l0aCgkMSkge1wiLGNsb3NlOlwifSBcIn0pfTthLiRhLnByb3RvdHlwZT1uZXcgYS5jYTthLiRhLnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj1hLiRhO3ZhciBiPW5ldyBhLiRhOzA8Yi5IZCYmYS5nYyhiKTthLmIoXCJqcXVlcnlUbXBsVGVtcGxhdGVFbmdpbmVcIixhLiRhKX0pKCl9KX0pKCk7fSkoKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlVXNlcih1c2VyKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XHJcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmVzb2x2ZSh7IHVzZXIsIHRva2VuOiBcInRlc3QudG9rZW5cIiB9KTtcclxuICAgICAgfSwgMTAwMCk7XHJcbiAgICB9KTtcclxuICB9IiwiLy92YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xyXG52YXIgY3JlYXRlVXNlciA9IHJlcXVpcmUgKCcuLi8uLi9zZGsvaW5kZXgnKTtcclxudmFyIHZhbGlkYXRpb24gPSByZXF1aXJlKCdrbm9ja291dC52YWxpZGF0aW9uJyk7XHJcblxyXG52YXIgdmlld01vZGVsID0ge1xyXG5cclxuICAgIC8vdHJhY2sgZm9ybSBzdGVwc1xyXG4gICAgYWN0aXZlU3RlcCA6IGtvLm9ic2VydmFibGUoMSksXHJcblxyXG4gICAgLy8gaWYgdXNlciBkbyByZWdpc3RlciBkb250IHNob3cgZm9ybSBhbmQgc2hvdyBzdWNjZWVkIG1lc3NhZ2VcclxuICAgIHN1Y2NlZWRSZWdpc3RlciA6IGtvLm9ic2VydmFibGUoZmFsc2UpLFxyXG5cclxuICAgIC8vIGZvcm0gZmllbGRzIHZhbHVlc1xyXG4gICAgbmFtZToga28ub2JzZXJ2YWJsZSgpLmV4dGVuZCh7XHJcbiAgICAgIG1pbkxlbmd0aDogMixcclxuICAgICAgcmVxdWlyZWQ6IHtcclxuICAgICAgICBtZXNzYWdlOiAnUGxlYXNlIGVudGVyIHlvdXIgbmFtZS4nXHJcbiAgICAgIH1cclxuICAgIH0pLFxyXG4gICAgYWdlOiBrby5vYnNlcnZhYmxlKCkuZXh0ZW5kKHtcclxuICAgICAgbWluOiAxLCBcclxuICAgICAgbWF4OiAxMDAsXHJcbiAgICAgIHJlcXVpcmVkOiB7XHJcbiAgICAgICAgbWVzc2FnZTogJ1BsZWFzZSBlbnRlciB5b3VyIGFnZS4nXHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICB9KSxcclxuICAgIG5ld3NsZXR0ZXI6IGtvLm9ic2VydmFibGUoKS5leHRlbmQoe3JlcXVpcmVkOiB0cnVlfSksXHJcbiAgICBlbWFpbDoga28ub2JzZXJ2YWJsZSgpLmV4dGVuZCh7XHJcbiAgICAgIC8vIGN1c3RvbSBtZXNzYWdlXHJcbiAgICAgIHJlcXVpcmVkOiB7XHJcbiAgICAgICAgICBtZXNzYWdlOiAnUGxlYXNlIGVudGVyIHlvdXIgZW1haWwgYWRkcmVzcy4nXHJcbiAgICAgIH0sXHJcbiAgICAgIGVtYWlsOiB0cnVlLFxyXG4gICAgIFxyXG4gICAgfSksXHJcbiAgICBuZXdzbGV0dGVyT3B0aW9uczogWydkYWlseScsICd3ZWVrbHknLCAnbW9udGhseSddLFxyXG5cclxuICAgIC8vIGZvcm0gZ28gdG8gbmV4dCBzdGVwXHJcbiAgICBnb1RvTmV4dFN0ZXAgOiBmdW5jdGlvbigpe1xyXG5cclxuICAgICAgaWYodGhpcy5uYW1lLmlzVmFsaWQoKSAmJiB0aGlzLmFnZS5pc1ZhbGlkKCkpe1xyXG4gICAgICAgIHZpZXdNb2RlbC5lcnJvcnMuc2hvd0FsbE1lc3NhZ2VzKGZhbHNlKVxyXG4gICAgICAgIHZhciAgcHJldmlvdXNTdGVwICA9IHRoaXMuYWN0aXZlU3RlcCgpO1xyXG4gICAgICAgIHRoaXMuYWN0aXZlU3RlcChwcmV2aW91c1N0ZXAgKyAxKVxyXG4gICAgICB9ZWxzZXtcclxuICAgICAgICB2aWV3TW9kZWwuZXJyb3JzLnNob3dBbGxNZXNzYWdlcygpXHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICB9LFxyXG5cclxuICAgIC8vIGZvcm0gZ28gYmFjayAxIHN0ZXBcclxuICAgIGdvVG9QcmV2U3RlcCA6IGZ1bmN0aW9uKCl7XHJcbiAgICAgIHZhciAgcHJldmlvdXNTdGVwICA9IHRoaXMuYWN0aXZlU3RlcCgpO1xyXG4gICAgICB0aGlzLmFjdGl2ZVN0ZXAocHJldmlvdXNTdGVwIC0gMSlcclxuICAgIH0sXHJcblxyXG4gICAgLy8gc3VibWl0IGZvcm1cclxuICAgIHN1Ym1pdDogZnVuY3Rpb24oKSB7XHJcbiAgICAgIC8vIGNoZWNrIGVycm9zIGJlZm9yZSBmaXJlIHN1Ym1pdFxyXG4gICAgICBpZiAodmlld01vZGVsLmVycm9ycygpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHZhciB1c2VyRGF0YSA9IHtcclxuICAgICAgICAgIG5hbWU6IHRoaXMubmFtZSgpLFxyXG4gICAgICAgICAgYWdlOiBOdW1iZXIodGhpcy5hZ2UoKSksXHJcbiAgICAgICAgICBlbWFpbDogdGhpcy5lbWFpbCgpLFxyXG4gICAgICAgICAgbmV3c2xldHRlcjogdGhpcy5uZXdzbGV0dGVyKCksXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNyZWF0ZVVzZXIodXNlckRhdGEpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2Upe1xyXG4gICAgICAgICAgdmlld01vZGVsLnN1Y2NlZWRSZWdpc3Rlcih0cnVlKTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgICB2aWV3TW9kZWwuZXJyb3JzLnNob3dBbGxNZXNzYWdlcygpO1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG5cclxufTtcclxuXHJcbnZpZXdNb2RlbC5lcnJvcnMgPSBrby52YWxpZGF0aW9uLmdyb3VwKHZpZXdNb2RlbCk7XHJcblxyXG5rby5hcHBseUJpbmRpbmdzKHZpZXdNb2RlbCk7XHJcblxyXG5cclxuIl19
