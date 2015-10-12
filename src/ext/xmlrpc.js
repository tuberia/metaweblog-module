/**
 * Module dependencies.
 */

var http = require('http'),
    https = require('https'),
    urlutil = require('url'),
    xml2js = require('xml2js').parseString,
    httpntlm = require('./httpntlm');
/**
 * HTML Special Characters
 * 
 * http://tntluoma.com/files/codes.htm
 */
var escape = exports.escape = function (s) {
    return String(s)
      .replace(/&(?!\w+;)/g, '&amp;')
      .replace(/@/g, '&#64;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
};
  
function Client(rpc_url, opts) {
  var info = urlutil.parse(rpc_url);
  this.http_request = http.request;
  this.options = {
    host: info.hostname,
    path: info.pathname || '/',
    method: 'POST',
  };
  var port = info.port || 80;
  var keepaliveAgent;
  if (info.protocol === 'https:') {
    this.http_request = https.request;
    if(!info.port) {
      port = 443;
    }
    var agentOptions = opts.caCert ? { ca: opts.caCert } : {};
    if (opts.caCert) {
      this.options.ca = opts.caCert;
    }
    var HttpsAgent = require('agentkeepalive').HttpsAgent;
    keepaliveAgent = new HttpsAgent(agentOptions);
    this.options.agent = keepaliveAgent;
  } else {
    var Agent = require('agentkeepalive');
    keepaliveAgent = new Agent();
    this.options.agent = keepaliveAgent;
  }
  this.options.port = port;
  this.url = rpc_url;
  this.config = opts;  
  if (info.query) {
    this.options.path += info.search;
  }
}

/**
 * create xml rpc request data
 * 
 * @param {String} method
 * @param param1, param2, ...
 * @param {Function} callback(result)
 * @return {String} xml string
 * @api public
 */
Client.prototype.request = function () {
	var len = arguments.length - 1;
	var callback = arguments[len];
	var params = [];
	for (var i = 0; i < len; i += 1) {
		params.push(arguments[i]);
	}
	var body = this.get_xml.apply(this, params);
	var options = this.options;
	var that = this;
  var req;
  if (this.config.ntlm) {
    httpntlm.post({
      url: this.url,
      username: this.config.ntlm.username,
      password: this.config.ntlm.password,
      workstation: this.config.ntlm.workstation,
      domain: this.config.ntlm.domain,
      ca: options.ca,
      options: {
        body: body,
        headers: {
          'Content-Type': 'text/xml',
          'Accept': '*/*'
        },
        agent: options.agent
      }
    }, function (err, res) {
      if (err) {
        return callback(err);
      }
      that.handleResponse(res, res.body, callback);
    });
  } else {
  	req = this.http_request(options, function (res) {
  		var chunks = [], length = 0;
  		res.on('data', function(chunk) {
  			length += chunk.length;
  			chunks.push(chunk);
  		});
  		res.on('end', function(){
  			var data = new Buffer(length);
  			// 延后copy
  			for (var i=0, pos=0, l=chunks.length; i<l; i += 1) {
  				chunks[i].copy(data, pos);
  				pos += chunks[i].length;
  			}
  			data = data.toString();
  			that.handleResponse(res, data, callback);
  		});
  	});
  	req.write(body);
  	req.end();
  }
};

Client.prototype.handleResponse = function (res, data, callback) {
  var error,
      xmlopts = {
        trim: true,
        explicitArray: false,
        async: true
      },
      self = this;
  if (res.statusCode === 200 || res.statusCode === 201) {
    xml2js(data, xmlopts, function (err, obj) {
      obj = self.parse(obj);
      if (obj && obj.faultString) {
        error = obj;
        error.code = obj.faultCode;
        error.message = obj.faultString;
        obj = null;
      }
      if (callback) {
        callback(error, obj, res);
      }
    });
  } else {
    error = data;
    data = null;
    if (callback) {
      callback(error, data, res);
    }
  }
};

/**
 * create xml rpc request data
 * 
 * <methodCall>
 *  <methodName>blogger.getUsersBlogs</methodName>
 *  <params>
 *      <param><value><string>fawave中文&lt;&gt;/?":</string></value></param>
 *      <param><value><string>fengmk2</string></value></param>
 *      <param><value><int>123</int></value></param>
 *  </params>
 * </methodCall>
 * 
 * @param {String} method
 * @param param1, param2, ...
 * @return {String} xml string
 * @api public
 */
Client.prototype.get_xml = function () {
	var method = arguments[0];
	var doc = [];
  doc.push('<?xml version="1.0" encoding="utf-8"?>');
	doc.push('<methodCall>');
	doc.push('<methodName>' + method + '</methodName>');
	if (arguments.length > 1) {
		doc.push('<params>');
		for (var i = 1, len = arguments.length; i < len; i += 1) {
		    doc.push('<param><value>');
			this.serialize(arguments[i], doc);
			doc.push('</value></param>');
		}
		doc.push('</params>');
	}
	doc.push('</methodCall>');
	return doc.join('\n');
};

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference:Global_Objects:Date
function ISODateString(d) {
	return d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) + 'T' +
        pad(d.getUTCHours()) + ':' +
        pad(d.getUTCMinutes()) + ':' +
        pad(d.getUTCSeconds()) + 'Z';
}

Client.prototype.serialize = function (data, d) {
  var i, len;
  if (typeof data === 'undefined') {
    data = '';
  }
	switch (data.constructor.name) {
	    case 'Array':
	        d.push('<array><data>');
	        for (i = 0, len = data.length; i < len; i += 1) {
	            d.push('<value>');
	            this.serialize(data[i], d);
	            d.push('</value>');
	        }
	        d.push('</data></array>');
	        break;
	    case 'Object':
	        d.push('<struct>');
	        for (i in data) {
	            d.push('<member>');
	            d.push('<name>' + i + '</name>');
	            d.push('<value>');
	            this.serialize(data[i], d);
	            d.push('</value>');
	            d.push('</member>');
	            
	        }
	        d.push('</struct>');
	        break;
	    case 'Number':
	        d.push('<int>' + data + '</int>');
	        break;
	    case 'String':
          if (data === '') {
            d.push('<string/>');
          } else {
  	        d.push('<string>' + escape(data) + '</string>');
          }
	    	break;
	    case 'Date': 
	        d.push('<dateTime.iso8601>' + ISODateString(data) + '</dateTime.iso8601>');
	        break;
	    case 'Boolean':
	        d.push('<boolean>' + (data ? '1' : '0') + '</boolean>');
	        break;
      case 'Buffer':
          d.push('<base64>' + data.toString('base64') + '</base64>');
          break;
	    default:
	        if (data === '') {
            d.push('<string/>');
          } else {
            d.push('<string>' + escape(data) + '</string>');
          }
	        break;
	}
};

function parseDate(iso) {
  iso = iso.replace('T', ' ');
  if (iso.indexOf('-') === -1) {
    iso = iso.substring(0, 4) + '-' + iso.substring(4, 6) + '-' + iso.substring(6);
  }
  return new Date(iso);
}

/**
 * rpc result parser
 * 
 * @param res
 * @returns
 */
Client.prototype.parse = function(res) {
    if(res.methodResponse) {
        res = res.methodResponse;
    }
    if(res.params) {
        res = res.params.param.value;
    } else if(res.fault) {
        res = res.fault.value;
    }
    return this._parse(res);
};

Client.prototype._parse = function(res) {
    var i, l, data;
    if (res && res.constructor.name !== 'Object') {
      return '' + res;
    }
    for (var name in res) {
        if (name === 'struct') {
            data = {};
            var members = res.struct.member;
            if (!members) {
                return data;
            }
            if (members.constructor.name !== 'Array') {
                members = [members];
            }
            for (i = 0, l = members.length; i < l; i += 1) {
                var member = members[i];
                data[member.name] = this.parse(member.value);
            }
            return data;
        } else if (name === 'array') {
            var values = res.array.data.value;
            if (values.constructor.name !== 'Array') {
                values = [values];
            }
            data = [];
            for (i = 0, l = values.length; i < l; i += 1) {
                data[i] = this.parse(values[i]);
            }
            return data; 
        } else if (name === 'boolean') {
            return res[name] === '1' || res[name] === 1;
        } else if (name === 'dateTime.iso8601') {
            return parseDate(res[name]);
        } else if (name === 'string') {
            return '' + res[name];
        } else if (name === 'int' || name === 'i4') {
            return 1 * res[name];
        } else if (name === 'base64') {
            return new Buffer(res[name], 'base64');
        } else {
            return res[name];
        }
    }
};

exports.Client = Client;