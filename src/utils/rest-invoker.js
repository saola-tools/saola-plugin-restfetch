'use strict';

const Devebot = require('devebot');
const Bluebird = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const fetch = require('node-fetch');

fetch.Promise = Bluebird;

function Service (params = {}) {
  const { errorBuilder, loggingFactory, packageName } = params;

  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, packageName);

  this.fetch = function (url, args, opts) {
    if ('trappedCode' in opts) {
      const { requestId, trappedCode, delay, total = 3, timeout } = opts;

      const loopOpts = {
        requestId,
        step: 1,
        loop: total,
        delay,
        trappedCode,
        expiredTime: new Date((new Date()).getTime() + timeout),
      };

      L.has('info') && L.log('info', T.add(loopOpts).toMessage({
        tags: [ blockRef, 'fetch' ],
        tmpl: '[${requestId}] Retry if the statusCode ${trappedCode} is trapped, expired at ${expiredTime}'
      }));

      loopOpts.errorBuilder = errorBuilder;

      return doFetch(url, args, loopOpts);
    }

    let p = fetch(url, args);
    if (opts.timeout != null && opts.timeout > 0) {
      p = p.timeout(opts.timeout);
    }

    return p;
  }
}

function doFetch (url, args, exts = {}) {
  let { delay, step, loop, trappedCode, expiredTime, errorBuilder } = exts;
  const now = new Date();
  if (expiredTime && expiredTime < now) {
    return Bluebird.reject(errorBuilder.newError('RetryRecallIsTimeout', {
      payload: {
        now: now.toISOString(),
        expiredTime: expiredTime.toISOString()
      }
    }));
  }
  if (step > loop) {
    return Bluebird.reject(errorBuilder.newError('RetryRecallOverLimit', {
      payload: { step, loop }
    }));
  }

  let p = fetch(url, args);

  p = p.then(function (res) {
    if (matchTrappedCodes(trappedCode, res.status)) {
      step = step + 1;
      let next = Bluebird.resolve();
      if (delay > 0) {
        next = next.delay(delay);
      }
      return next.then(function() {
        return doFetch(url, args, exts);
      });
    }
    return res;
  });

  return p;
}

function matchTrappedCodes (trappedCodes, statusCode) {
  if (trappedCodes) {
    if (lodash.isNumber(trappedCodes) && trappedCodes === statusCode) {
      return true;
    }
    if (lodash.isArray(trappedCodes) && trappedCodes.indexOf(statusCode) >= 0) {
      return true;
    }
  }
  return false;
}

module.exports = Service;
