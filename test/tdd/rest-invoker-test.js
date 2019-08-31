'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('liberica').assert;
var mockit = require('liberica').mockit;

describe('rest-invoker', function() {
  var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
  var ctx = {
    L: loggingFactory.getLogger(),
    T: loggingFactory.getTracer(),
    blockRef: 'app-restfetch/restInvoker',
  }

  describe('fetch() method', function() {
    it('skip the retry-loop if the trappedCode attribute is absent');

    it('skip the retry-loop if the waiting.enabled is false');

    it('invoke the doFetch() function in the retry-loop case');

    it('invoke the basic fetch() function if the retry-loop condition is not satisfied');
  });
});
