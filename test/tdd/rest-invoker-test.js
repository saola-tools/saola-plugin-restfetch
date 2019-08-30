'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('liberica').assert;
var mockit = require('liberica').mockit;

describe('rest-invoker', function() {
  describe('fetch()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch/restInvoker',
    }
  });
});
