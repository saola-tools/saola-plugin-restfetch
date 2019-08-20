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

  this.fetch = function fetchLoop (url, args, opts) {
    if ('trappedCode' in opts) {
      const { trappedCode, delay, total = 3, timeout } = opts;
      return doFetch(url, args, {
        step: 1,
        loop: total,
        delay,
        trappedCode,
        expiredTime: new Date((new Date()).getTime() + timeout),
        errorBuilder
      });
    }
    let p = fetch(url, args);
    if (opts.timeout != null && opts.timeout > 0) {
      p = p.timeout(opts.timeout);
    }
    return p;
  }
}

function doFetch (url, args, { delay, step, loop, trappedCode, expiredTime, errorBuilder }) {
  let p = fetch(url, args);

  p = p.then(function (res) {
    if (res.status === trappedCode) {
      const now = new Date();
      if (expiredTime && expiredTime < now) {
        return Bluebird.reject(errorBuilder.newError('RetryLoopIsTimeout', {
          payload: {
            now: now.toISOString(),
            expiredTime: expiredTime.toISOString()
          }
        }));
      }
      if (step > loop) {
        return Bluebird.reject(errorBuilder.newError('RetryLoopOverLimit', {
          payload: { step, loop }
        }));
      }
      step = step + 1;
      let next = Bluebird.resolve();
      if (delay > 0) {
        next = next.delay(delay);
      }
      return next.then(function() {
        return doFetch(url, args, { trappedCode, delay, step, loop, expiredTime });
      });
    }
    return res;
  });

  return p;
}

module.exports = Service;
