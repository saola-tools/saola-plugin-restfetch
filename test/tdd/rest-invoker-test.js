'use strict';

var devebot = require('devebot');
var Bluebird = devebot.require('bluebird');
var assert = require('liberica').assert;
var mockit = require('liberica').mockit;
var path = require('path');

describe('rest-invoker', function() {
  var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
  var ctx = {
    L: loggingFactory.getLogger(),
    T: loggingFactory.getTracer(),
    blockRef: 'app-restfetch/restInvoker',
  }

  describe('this.fetch() method', function() {
    var RestInvoker = mockit.acquire('rest-invoker', {
      moduleHome: path.join(__dirname, '../../lib/utils/')
    });
    var restInvoker;
    var doFetch;
    var fetch;

    var url = "http://www.url.com";
    var args = {};

    beforeEach(function() {
      doFetch = mockit.stub(RestInvoker, 'doFetch');
      fetch = mockit.stub(RestInvoker, 'fetch');
      restInvoker = new RestInvoker({
        errorBuilder: null,
        loggingFactory: loggingFactory,
        packageName: 'app-restfetch'
      });
    });

    it('skip the retry-loop if the trappedCode attribute is absent', async function() {
      fetch.returns(Bluebird.resolve());
      const result = await restInvoker.fetch(url, args, {})
      assert.equal(fetch.callCount, 1);
      return result;
    });

    it('invoke the doFetch() function in the retry-loop case', async function() {
      var opts = { trappedCode: 201 };
      doFetch.returns(Bluebird.resolve());
      const result = await restInvoker.fetch(url, args, opts);
      assert.equal(doFetch.callCount, 1);
      const doFetch_1_args = doFetch.args[0];
      // verify the doFetch arguments
      assert.equal(doFetch_1_args.length, 3);
      assert.equal(doFetch_1_args[0], url);
      assert.deepEqual(doFetch_1_args[1], args);
      const loopOpts = doFetch_1_args[2];
      assert.include(loopOpts, {
        step: 1,
        loop: 3,
        trappedCode: 201
      });
      assert.deepEqual(Object.keys(loopOpts), [
        'requestId',
        'step',
        'loop',
        'delay',
        'trappedCode',
        'expiredTime',
        'errorBuilder'
      ]);
      return result;
    });
  });
});
