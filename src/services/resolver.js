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
  const { loggingFactory, sandboxConfig, packageName } = params;
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  const { counselor, errorManager } = params;

  const errorBuilder = errorManager.register(packageName, {
    errorCodes: sandboxConfig.errorCodes
  });

  const restInvoker = new RestInvoker({ errorBuilder, loggingFactory, packageName });
  const injektor = new Injektor(chores.injektorOptions);

  const mappings = counselor.mappings;
  const services = {};
  const ctx = { L, T, blockRef, restInvoker, injektor, errorBuilder,
    responseOptions: sandboxConfig.responseOptions,
    BusinessError: errorManager.BusinessError
  };

  init(ctx, services, mappings, sandboxConfig.enabled !== false);

  this.lookupService = function(serviceName) {
    return services[serviceName];
  }
};

Service.referenceHash = {
  counselor: 'counselor',
  errorManager: 'app-errorlist/manager'
};

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
    const methodContext = lodash.pick(serviceDescriptor, ["arguments", "urlObject"], {});
    const methods = serviceDescriptor.methods || {};
    lodash.forOwn(methods, function(methodDescriptor, methodName) {
      registerMethod(ctx, storage[serviceName], methodName, methodDescriptor, methodContext);
    });
  }
  return storage;
}

function registerMethod(ctx, target, methodName, methodDescriptor, methodContext) {
  const { L, T, blockRef, BusinessError, errorBuilder, responseOptions, restInvoker } = ctx;

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

          const fetchOpts = {
            requestId,
            timeout: methodDescriptor.timeout
          };

          if (methodDescriptor.waiting && methodDescriptor.waiting.enabled !== false) {
            lodash.assign(fetchOpts, {
              total: 3,
              delay: 1000,
              trappedCode: 202,
            }, lodash.pick(methodDescriptor.waiting, [
              'total', 'delay', 'trappedCode'
            ]));
          }

          let p = restInvoker.fetch(FA.url, FA.args, fetchOpts);

          // rebuild the Error object if any (node-fetch/response)
          p = p.then(function (res) {
            const HTTP_HEADER_RETURN_CODE = lodash.get(responseOptions, [
              'returnCode', 'headerName'
            ], 'X-Return-Code');
            const returnCode = res.headers.get(HTTP_HEADER_RETURN_CODE);
            if (returnCode != null && returnCode !== '0' && returnCode !== 0) {
              return Bluebird.resolve(res.json()).then(function(body) {
                const errName = body && body.name || 'UnknownError';
                const errMessage = body && body.message || 'Error message not found';
                const errOptions = {
                  payload: (body && body.payload),
                  statusCode: res.status,
                  returnCode: returnCode
                }
                return Bluebird.reject(new BusinessError(errName, errMessage, errOptions));
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

          // node-fetch error processing
          p = p.catch(function (err) {
            L.has('warn') && L.log('warn', T.add({
              requestId, ticketId, methodName, eName: err.name, eMessage: err.message
            }).toMessage({
              tags: [ blockRef, 'method-rest' ],
              text: '[${requestId}] Method[${methodName}] has failed, error[${eName}]: ${eMessage}'
            }));
            // Business errors
            if (err instanceof BusinessError) {
              return Bluebird.reject(err);
            }
            // timeout from Promise.timeout()
            if (err instanceof Bluebird.TimeoutError) {
              return Bluebird.rejec(errorBuilder.newError('RequestTimeoutOnClient', {
                payload: {
                  requestId: requestId,
                  timeout: methodDescriptor.timeout,
                }
              }));
            }
            // node-fetch errors
            if (err.name === 'AbortError') {
              return Bluebird.rejec(errorBuilder.newError('RequestAbortedByClient', {
                payload: {
                  requestId: requestId,
                }
              }));
            }
            return Bluebird.reject(err);
          });

          if (F.transformException) {
            p = p.catch(function(err) {
              return Bluebird.reject(F.transformException(err));
            });
          }

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
    lodash.pick(lodash.get(context, ["arguments", "default"], {}), FETCH_ARGS_FIELDS),
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

  let urlObj = null;
  let urlString = descriptor.url;

  let customUrl = methodArgs.customUrl;
  if (!lodash.isEmpty(customUrl)) {
    urlString = customUrl;
  }

  if (lodash.isString(urlString) && urlString.length > 0) {
    urlObj = url.parse(urlString);
  } else {
    urlObj = lodash.merge({}, context.urlObject, descriptor.urlObject);
  }

  if (lodash.isEmpty(urlObj)) {
    return { error: new Error('invalid-http-url') }
  }

  if (urlObj.pathname) {
    if (!descriptor.pathnameRegexp) {
      descriptor.pathnameRegexp = pathToRegexp.compile(urlObj.pathname);
    }
  }

  if (descriptor.pathnameRegexp) {
    try {
      urlObj.pathname = descriptor.pathnameRegexp(opts.params);
    } catch (error) {
      return { error: error }
    }
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
  exception: null,
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
    },
    "customUrl": {
      "type": "string"
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
