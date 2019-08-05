'use strict';

const Devebot = require('devebot');
const Bluebird = Devebot.require('bluebird');
const Injektor = Devebot.require('injektor');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const schemato = Devebot.require('schemato');
const validator = new schemato.Validator({ schemaVersion: 4 });
const valvekit = require('valvekit');
const pathToRegexp = require('path-to-regexp');
const fetch = require('node-fetch');
const url = require('url');

fetch.Promise = Bluebird;

function Service(params = {}) {
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const packageName = params.packageName || 'app-restfetch';
  const blockRef = chores.getBlockRef(__filename, packageName);

  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const mappings = params.counselor.mappings;
  const injektor = new Injektor(chores.injektorOptions);
  const services = {};

  let ticketDeliveryDelay = pluginCfg.ticketDeliveryDelay || null;
  if (!(lodash.isInteger(ticketDeliveryDelay) && ticketDeliveryDelay > 0)) {
    ticketDeliveryDelay = null;
  }

  let throughputValve = null;
  if (lodash.isInteger(pluginCfg.throughputQuota) && pluginCfg.throughputQuota > 0) {
    L.has('debug') && L.log('debug', T.add({
      throughputQuota: pluginCfg.throughputQuota
    }).toMessage({
      tags: [ blockRef, 'quota-ticket' ],
      text: ' - Create throughput valve: ${throughputQuota}'
    }));
    throughputValve = valvekit.createSemaphore(pluginCfg.throughputQuota);
  }

  const ctx = {
    L, T, blockRef, injektor, throughputValve, ticketDeliveryDelay
  }

  this.lookupService = function(serviceName) {
    return services[serviceName];
  }

  init(ctx, services, mappings, pluginCfg.enabled !== false);
};

Service.referenceList = [ 'counselor' ];

module.exports = Service;

function init(ctx, services, mappings, enabled) {
  const { L, T, blockRef } = ctx;
  L.has('debug') && L.log('debug', T.add({ enabled }).toMessage({
    tags: [ blockRef, 'init-mappings' ],
    text: ' - Initialize the mappings, enabled: ${enabled}'
  }));
  if (enabled === false) return;
  lodash.forOwn(mappings, function(serviceDescriptor, serviceName) {
    createService(ctx, services, serviceName, serviceDescriptor);
  });
}

function createService(ctx, storage, serviceName, serviceDescriptor) {
  const { L, T, blockRef } = ctx;
  storage = storage || {};
  storage[serviceName] = storage[serviceName] || {};
  L.has('debug') && L.log('debug', T.add({
    enabled: serviceDescriptor.enabled !== false,
    serviceName: serviceName
  }).toMessage({
    tags: [ blockRef, 'register-service' ],
    text: ' - Initialize the service[${serviceName}], enabled: ${enabled}'
  }));
  if (serviceDescriptor.enabled !== false) {
    const methodContext = lodash.get(serviceDescriptor, ["arguments", "default"], {});
    const methods = serviceDescriptor.methods || {};
    lodash.forOwn(methods, function(methodDescriptor, methodName) {
      registerMethod(ctx, storage[serviceName], methodName, methodDescriptor, methodContext);
    });
  }
  return storage;
}

function registerMethod(ctx, target, methodName, methodDescriptor, methodContext) {
  const { L, T, blockRef } = ctx;

  target = target || {};
  methodDescriptor = methodDescriptor || {};

  L.has('debug') && L.log('debug', T.add({
    methodName: methodName,
    enabled: methodDescriptor.enabled !== false
  }).toMessage({
    tags: [ blockRef, 'register-method' ],
    text: '   | Initialize method[${methodName}], enabled: ${enabled}'
  }));

  if (methodDescriptor.enabled === false) return target;

  const F = new Transformer(methodDescriptor);

  Object.defineProperty(target, methodName, {
    get: function() {
      return function() {
        const methodArgs = F.transformArguments(...arguments);
        // validate the methodArgs
        const vResult = validateMethodArgs(methodArgs);
        if (!vResult.ok) {
          return Bluebird.reject(new Error(JSON.stringify(vResult.errors)));
        }
        return getTicket(ctx).then(function(ticketId) {
          const requestId = methodArgs.requestId = methodArgs.requestId || T.getLogID();
          L.has('info') && L.log('info', T.add({
            requestId, ticketId, methodName, methodArgs
          }).toMessage({
            tags: [ blockRef, 'method-rest' ],
            text: '[${requestId}] Method[${methodName}] arguments: ${methodArgs}'
          }));

          const FA = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
          if (FA.error) {
            L.has('error') && L.log('error', T.add({
              requestId, ticketId, methodName
            }).toMessage({
              tags: [ blockRef, 'method-rest' ],
              text: '[${requestId}] Method[${methodName}] - buildFetchArgs() failed'
            }));
            return Bluebird.reject(FA.error);
          } else {
            L.has('debug') && L.log('debug', T.add({
              requestId, ticketId, methodName, url: FA.url, headers: FA.args.headers, body: FA.args.body
            }).toMessage({
              tags: [ blockRef, 'method-rest' ],
              text: '[${requestId}] Method[${methodName}] is bound to url [${url}], headers: ${headers}, body: ${body}'
            }));
          }

          let p = fetch(FA.url, FA.args);

          if (FA.timeout != null && FA.timeout > 0) {
            p = p.timeout(FA.timeout);
          }

          // response processing
          p = p.then(function (res) {
            L.has('info') && L.log('info', T.add({
              requestId, ticketId, methodName
            }).toMessage({
              tags: [ blockRef, 'method-rest' ],
              text: '[${requestId}] Method[${methodName}] has been done successfully'
            }));
            const output = F.transformResponse(res);
            // TODO: validate descriptor here
            return Bluebird.resolve(output);
          });

          // error processing
          p = p.catch(function (err) {
            L.has('warn') && L.log('warn', T.add({
              requestId, ticketId, methodName
            }).toMessage({
              tags: [ blockRef, 'method-rest' ],
              text: '[${requestId}] Method[${methodName}] has failed'
            }));
            return Bluebird.reject(F.transformException(err));
          });

          // finally
          p = p.finally(function() {
            releaseTicket(ctx, ticketId);
          });

          return p;
        });
      }
    },
    set: function(val) {}
  });
  return target;
}

const FETCH_ARGS_FIELDS = ["headers", "params", "query"];

function buildFetchArgs(context = {}, descriptor = {}, methodArgs = {}) {
  const opts = lodash.merge({},
    lodash.pick(context, FETCH_ARGS_FIELDS),
    lodash.pick(lodash.get(descriptor, ["arguments", "default"], {}), FETCH_ARGS_FIELDS),
    lodash.pick(methodArgs, FETCH_ARGS_FIELDS));
  const args = {
    method: descriptor.method,
    headers: opts.headers || {}
  }
  if (!lodash.isString(args.method)) {
    return { error: new Error('invalid-http-method') }
  }

  if (methodArgs.body != null) {
    if (lodash.isObject(methodArgs.body)) {
      if (!args.headers['Content-Type']) {
        args.headers['Content-Type'] = 'application/json';
      }
      args.body = JSON.stringify(methodArgs.body);
    } else if (lodash.isString(methodArgs.body)) {
      args.body = methodArgs.body;
    }
  }

  let urlString = descriptor.url;
  if (!lodash.isString(urlString) || urlString.length == 0) {
    return { error: new Error('invalid-http-url') }
  }

  let urlObj = url.parse(urlString);

  if (!descriptor.pathnameRegexp) {
    descriptor.pathnameRegexp = pathToRegexp.compile(urlObj.pathname);
  }
  try {
    urlObj.pathname = descriptor.pathnameRegexp(opts.params);
  } catch (error) {
    return { error: error }
  }

  urlString = url.format(urlObj);

  if (lodash.isObject(opts.query) && !lodash.isEmpty(opts.query)) {
    urlString = urlString + '?' + getQueryString(opts.query);
  }

  let timeout = descriptor.timeout;

  return { url: urlString, args, timeout };
}

function getQueryString(params) {
  return lodash.keys(params).map(function(k) {
    if (lodash.isArray(params[k])) {
      return params[k].map(function(val) {
        return `${encodeURIComponent(k)}[]=${encodeURIComponent(val)}`
      }).join('&')
    }
    return `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  }).join('&')
}

const DEFAULT_TRANSFORMERS = {
  arguments: function () {
    if (arguments.length == 0) {
      return {};
    }
    return arguments[0];
  },
  response: function (res) {
    if (this.format === 'text') {
      return res.text();
    }
    return res.json();
  },
  exception: function (error) {
    return error;
  }
}

function Transformer(descriptor) {
  const self = this;
  lodash.forOwn(DEFAULT_TRANSFORMERS, function(transformDefault, name) {
    const transform = lodash.get(descriptor, [name, "transform"]);
    const transformName = "transform" + lodash.capitalize(name);
    self[transformName] = lodash.isFunction(transform) ? transform : transformDefault;
  })
}

const SCHEMA_METHOD_ARGS = {
  "type": "object",
  "properties": {
    "requestId": {
      "type": "string"
    },
    "params": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z][a-zA-Z0-9_-]*$": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            },
            {
              "type": "boolean"
            }
          ]
        }
      }
    },
    "query": {
      "type": "object"
    },
    "headers": {
      "type": "object",
      "patternProperties": {
        "^[a-zA-Z][a-zA-Z0-9_-]*$": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            },
            {
              "type": "boolean"
            }
          ]
        }
      }
    },
    "body": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "object"
        }
      ]
    }
  },
  "additionalProperties": false
}

function validateMethodArgs(object) {
  return validator.validate(object, SCHEMA_METHOD_ARGS);
}

function getTicket(ctx) {
  const { L, T, blockRef, throughputValve, ticketDeliveryDelay } = ctx;
  let ticketId = T.getLogID();
  let ticket;
  if (throughputValve) {
    ticket = new Bluebird(function(onResolved, onRejected) {
      throughputValve.take(function whenResourceAvailable() {
        L.has('debug') && L.log('debug', T.add({
          ticketId: ticketId,
          waiting: throughputValve.waiting,
          available: throughputValve.available,
          capacity: throughputValve.capacity
        }).toMessage({
          tags: [ blockRef, 'lock-valve' ],
          text: ' - Lock throughput ticket[${ticketId}] - [${waiting}/${available}/${capacity}]'
        }));
        onResolved(ticketId);
      });
    });
  } else {
    ticket = Bluebird.resolve(ticketId);
  }
  return ticketDeliveryDelay ? ticket.delay(ticketDeliveryDelay) : ticket;
}

function releaseTicket(ctx, ticketId) {
  const { L, T, blockRef, throughputValve } = ctx;
  if (throughputValve) {
    throughputValve.release();
    L.has('debug') && L.log('debug', T.add({
      ticketId: ticketId,
      waiting: throughputValve.waiting,
      available: throughputValve.available,
      capacity: throughputValve.capacity
    }).toMessage({
      tags: [ blockRef, 'unlock-valve' ],
      text: ' - Unlock throughput ticket[${ticketId}] - [${waiting}/${available}/${capacity}]'
    }));
  }
}
