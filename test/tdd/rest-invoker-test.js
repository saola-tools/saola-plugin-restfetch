"use strict";

const devebot = require("devebot");
const Bluebird = devebot.require("bluebird");
const assert = require("liberica").assert;
const mockit = require("liberica").mockit;
const path = require("path");

describe("utils:rest-invoker", function() {
  const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });

  describe("this.fetch() method", function() {
    let RestInvoker = mockit.acquire("rest-invoker", {
      moduleHome: path.join(__dirname, "../../lib/utils/")
    });
    let restInvoker;
    let doFetch;
    let fetch;

    let url = "http://www.url.com";
    let args = {};

    beforeEach(function() {
      doFetch = mockit.stub(RestInvoker, "doFetch");
      fetch = mockit.stub(RestInvoker, "fetch");
      restInvoker = new RestInvoker({
        errorBuilder: null,
        loggingFactory: loggingFactory,
        packageName: "app-restfetch"
      });
    });

    it("skip the retry-loop if the trappedCode attribute is absent", async function() {
      fetch.returns(Bluebird.resolve());
      const result = await restInvoker.fetch(url, args, {});
      assert.equal(fetch.callCount, 1);
      return result;
    });

    it("invoke the doFetch() function in the retry-loop case", async function() {
      const opts = { trappedCode: 201 };
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
        "requestId",
        "step",
        "loop",
        "delay",
        "trappedCode",
        "expiredTime",
        "errorBuilder"
      ]);
      return result;
    });
  });
});
