var async = require('async');
var url = require('url');
var httpreq = require('httpreq');
var ntlm = require('./ntlm');

exports.method = function(method, options, callback) {
	if (!options.workstation) {
		options.workstation = '';
	}
	if (!options.domain) {
		options.domain = '';
	}

	// is https?
	var isHttps = false;
	var reqUrl = url.parse(options.url);
	if (reqUrl.protocol === 'https:') {
		isHttps = true;
	}

	// set keepaliveAgent (http or https):
	var keepaliveAgent;

	if (isHttps) {
      var HttpsAgent = require('agentkeepalive').HttpsAgent;
      keepaliveAgent = new HttpsAgent();
	} else {
      var Agent = require('agentkeepalive');
      keepaliveAgent = new Agent();
	}

	function extendOptions(target, source) {
		for (var k in source) {
			if (source.hasOwnProperty(k)) {
				target[k] = source[k];
			}
		}
	}

	async.waterfall([

		function($) {
			var type1msg = ntlm.createType1Message(options),
				opts = options.options || {};

			opts.agent = opts.agent || keepaliveAgent;
			if (options.ca) {
				opts.ca = options.ca;
			}
			opts.headers = opts.headers || {};
			extendOptions(opts.headers, {
				'Connection': 'keep-alive',
				'Authorization': type1msg
			});

			httpreq.get(options.url, opts, $);
		},

		function(res, $) {
			if (!res.headers['www-authenticate']) {
				return $(new Error('www-authenticate not found on response of second request'));
			}

			var type2msg = ntlm.parseType2Message(res.headers['www-authenticate']),
				type3msg = ntlm.createType3Message(type2msg, options),
				opts = options.options || {};

			opts.agent = opts.agent || keepaliveAgent;
			opts.allowRedirects = false;
			opts.headers = opts.headers || {};
			extendOptions(opts.headers, {
				'Connection': 'Close',
				'Authorization': type3msg
			});

			httpreq[method](options.url, opts, $);
		}
	], callback);
};

['get', 'put', 'post', 'delete', 'head'].forEach(function(method) {
	exports[method] = exports.method.bind(exports, method);
});

exports.ntlm = ntlm; //if you want to use the NTML functions yourself
