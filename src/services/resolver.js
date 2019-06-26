'use strict';

const Devebot = require('devebot');
const Bluebird = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const valvekit = require('valvekit');
const pathToRegexp = require('path-to-regexp');
const fetch = require('node-fetch');

fetch.Promise = Bluebird;

function Service(params = {}) {
  let L = params.loggingFactory.getLogger();
  let T = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-restfetch';
  let blockRef = chores.getBlockRef(__filename, packageName);

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let mappings = pluginCfg.mappings || {};
  if (lodash.isString(pluginCfg.mappingStore)) {
    mappings = lodash.assign(mappings, require(pluginCfg.mappingStore))
  }
  let services = {};

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
    L, T, blockRef, throughputValve, ticketDeliveryDelay
  }

  this.lookupService = function(serviceName) {
    return services[serviceName];
  }

  init(ctx, services, mappings, pluginCfg.enabled !== false);
};

Service.referenceList = [];

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
    name: serviceName
  }).toMessage({
    tags: [ blockRef, 'register-service' ],
    text: ' - Initialize the service[${name}], enabled: ${enabled}'
  }));
  if (serviceDescriptor.enabled !== false) {
    const methodContext = lodash.get(serviceDescriptor, "default", {});
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

  const routineTr = T.branch({ key: 'methodName', value: methodName });

  L.has('debug') && L.log('debug', routineTr.add({
    enabled: methodDescriptor.enabled !== false
  }).toMessage({
    tags: [ blockRef, 'register-method' ],
    text: ' - Initialize method[${name}] ~ routine[${methodName}], enabled: ${enabled}'
  }));

  if (methodDescriptor.enabled === false) return target;

  Object.defineProperty(target, methodName, {
    get: function() {
      return function() {
        const { methodArgs, options } = parseMethodArgs(arguments);
        return getTicket(ctx).then(function(ticketId) {
          const requestId = options.requestId || T.getLogID();
          const requestTrail = routineTr.branch({ key:'requestId', value:requestId });
          L.has('info') && L.log('info', requestTrail.add({
            ticketId: ticketId,
            methodName: methodName,
            methodArgs: methodArgs,
            options: options
          }).toMessage({
            tags: [ blockRef, 'dispatch-message' ],
            text: '[${ticketId}] Routine[${methodName}] arguments: ${methodArgs}, options: ${options}'
          }));
          const FA = buildFetchArgs(methodContext, methodDescriptor, methodArgs, options);
          if (FA.error) {
            return Bluebird.reject(FA.error);
          }

          let p = fetch(FA.url, FA.args);

          if (FA.timeout != null && FA.timeout > 0) {
            p = p.timeout(FA.timeout);
          }

          // response processing
          p = p.then(function (res) {
            // TODO: validate descriptor here
            return Bluebird.resolve(res.json());
          });

          // error processing
          p = p.catch(function (err) {
            return Bluebird.reject(err);
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

function buildFetchArgs(context = {}, descriptor = {}, methodArgs, methodOpts) {
  let args = {
    method: descriptor.method,
    headers: {
      'Content-Type': 'application/json'
    }
  }
  if (!lodash.isString(args.method)) {
    return { error: new Error('invalid-http-method') }
  }

  let url = descriptor.url;
  if (!lodash.isString(url) || url.length == 0) {
    return { error: new Error('invalid-http-url') }
  }
  if (!descriptor.urlRegexp) {
    descriptor.urlRegexp = pathToRegexp.compile(url);
  }
  const urlRegexp = descriptor.urlRegexp;
  const urlParams = lodash.merge({},
      lodash.get(context, "params"),
      lodash.get(descriptor, ["default", "params"]),
      lodash.get(methodArgs, "0.params"));
  try {
    url = urlRegexp(urlParams);
  } catch (error) {
    return { error: error }
  }
  const urlQuery = lodash.merge({},
    lodash.get(context, "query"),
    lodash.get(descriptor, ["default", "query"]),
    lodash.get(methodArgs, "0.query"));
  if (lodash.isObject(urlQuery) && !lodash.isEmpty(urlQuery)) {
    url = url + '?' + getQueryString(urlQuery);
  }

  let timeout = descriptor.timeout;

  return { url, args, timeout };
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

function parseMethodArgs(args) {
  let opts = {};
  if (args.length > 0) {
    opts = args[args.length - 1];
    if (opts && lodash.isObject(opts) && opts.requestId && opts.opflowSeal) {
      args = Array.prototype.slice.call(args, 0, args.length - 1);
    } else {
      args = Array.prototype.slice.call(args);
      opts = {};
    }
  }
  return { methodArgs: args, options: opts }
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
