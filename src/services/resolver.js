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
const RestInvoker = require('../utils/rest-invoker');
const url = require('url');

function Service(params = {}) {
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const packageName = params.packageName || 'app-restfetch';
  const blockRef = chores.getBlockRef(__filename, packageName);

  const sandboxConfig = lodash.get(params, ['sandboxConfig'], {});
  const mappings = params.counselor.mappings;
  const injektor = new Injektor(chores.injektorOptions);
  const restInvoker = new RestInvoker(params);
  const services = {};
  const ctx = { L, T, blockRef, restInvoker, injektor,
    responseOptions: sandboxConfig.responseOptions
  };

  init(ctx, services, mappings, sandboxConfig.enabled !== false);

  this.lookupService = function(serviceName) {
    return services[serviceName];
  }
};

Service.referenceList = [ 'counselor' ];

module.exports = Service;

function applyThroughput (ctx, descriptor = {}, box = {}) {
  const { L, T, blockRef } = ctx;
  box.ticketDeliveryDelay = descriptor.ticketDeliveryDelay || null;
  if (!(lodash.isInteger(box.ticketDeliveryDelay) && box.ticketDeliveryDelay > 0)) {
    box.ticketDeliveryDelay = null;
  }
  box.throughputValve = null;
  if (lodash.isInteger(descriptor.throughputQuota) && descriptor.throughputQuota > 0) {
    L.has('debug') && L.log('debug', T.add({
      throughputQuota: descriptor.throughputQuota
    }).toMessage({
      tags: [ blockRef, 'quota-ticket' ],
      text: ' - Create throughput valve with the limit: ${throughputQuota}'
    }));
    box.throughputValve = valvekit.createSemaphore(descriptor.throughputQuota);
  }
  return box;
}

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
  const { L, T, blockRef, responseOptions, restInvoker } = ctx;
  const box = applyThroughput(ctx, methodDescriptor);

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
        const _arguments = arguments;
        let ticketId;
        let ticket = getTicket(ctx, box).then(function(_ticketId) {
          ticketId = _ticketId;

          // transform and validate the methodArgs
          const methodArgs = F.transformArguments(..._arguments);
          const vResult = validateMethodArgs(methodArgs);
          if (!vResult.ok) {
            return Bluebird.reject(new Error(JSON.stringify(vResult.errors)));
          }

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

          const waitingOpts = {
            total: 3,
            delay: 1000,
            trappedCode: 202,
            timeout: methodDescriptor.timeout
          };

          if (methodDescriptor.waiting && lodash.isObject(methodDescriptor.waiting)) {
            lodash.assign(waitingOpts, lodash.pick(methodDescriptor.waiting, [
              'total', 'delay', 'trappedCode'
            ]));
          }

          let p = restInvoker.fetch(FA.url, FA.args, waitingOpts);

          // rebuild the Error object if any (node-fetch/response)
          p = p.then(function (res) {
            const HTTP_HEADER_RETURN_CODE = lodash.get(responseOptions, [
              'returnCode', 'headerName'
            ], 'X-Return-Code');
            const returnCode = res.headers.get(HTTP_HEADER_RETURN_CODE);
            if (returnCode != null && returnCode !== '0' && returnCode !== 0) {
              return Bluebird.resolve(res.json()).then(function(body) {
                const err = new Error(body && body.message || 'Error message not found');
                err.name = body && body.name || 'UnknownError';
                err.payload = body && body.payload;
                err.statusCode = res.status;
                err.returnCode = returnCode;
                return Bluebird.reject(err);
              });
            }
            return res;
          });

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
              requestId, ticketId, methodName, eName: err.name, eMessage: err.message
            }).toMessage({
              tags: [ blockRef, 'method-rest' ],
              text: '[${requestId}] Method[${methodName}] has failed, error[${eName}]: ${eMessage}'
            }));
            return Bluebird.reject(F.transformException(err));
          });

          return p;
        });

        ticket.finally(function() {
          releaseTicket(ctx, box, ticketId);
        });

        return ticket;
      }
    },
    set: function(val) {}
  });
  return target;
}

const FETCH_ARGS_FIELDS = [ "headers", "params", "query" ];

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

function getTicket(ctx, box = {}) {
  const { L, T, blockRef } = ctx;
  const { throughputValve, ticketDeliveryDelay } = box;
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

function releaseTicket(ctx, box = {}, ticketId) {
  const { L, T, blockRef } = ctx;
  const { throughputValve } = box;
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
