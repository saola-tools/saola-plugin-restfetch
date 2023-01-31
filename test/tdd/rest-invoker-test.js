"use strict";

const Devebot = require("@saola/core");
const Bluebird = Devebot.require("bluebird");
const assert = require("liberica").assert;
const mockit = require("liberica").mockit;
const path = require("path");

const moduleHome = path.join(__dirname, "../../lib/utils/");

const errorBuilder = {
  newError: function(name, options) {
    const err = new Error(name);
    err.name = name;
    err.payload = options.payload;
    return err;
  }
}

describe("utils:rest-invoker", function() {
  const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });

  describe("this.fetch() method", function() {
    let RestInvoker = mockit.acquire("rest-invoker", { moduleHome });
    let restInvoker;
    let fetch;

    let url = "http://www.url.com";
    let args = {};

    beforeEach(function() {
      fetch = mockit.stub(RestInvoker, "fetch");
      restInvoker = new RestInvoker({
        errorBuilder: errorBuilder,
        loggingFactory: loggingFactory,
        packageName: "@saola/plugin-restfetch"
      });
    });

    it("skip the retry-loop if the trappedCode attribute is absent", async function() {
      fetch.returns(Bluebird.resolve());
      const result = await restInvoker.fetch(url, args, {});
      assert.equal(fetch.callCount, 1);
      return result;
    });

    it("invoke the loopFetch() function in the retry-loop case", async function() {
      const opts = { trappedCode: 201 };
      fetch.returns(Bluebird.resolve({ status: 200 }));
      const result = await restInvoker.fetch(url, args, opts);
      assert.equal(fetch.callCount, 1);
      const fetchArgs0 = fetch.args[0];
      // verify the fetch arguments
      assert.equal(fetchArgs0.length, 2);
      assert.equal(fetchArgs0[0], url);
      assert.deepEqual(fetchArgs0[1], args);
      return result;
    });

    it("loopFetch() exceeds the retry limit must return the error: RetryRecallOverLimit", async function() {
      const opts = {
        total: 3,
        trappedCode: 201
      };
      //
      fetch.onCall(0).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(1).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(2).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(3).returns(Bluebird.resolve({ status: 200 }));
      //
      try {
        const result = await restInvoker.fetch(url, args, opts);
        assert.fail("restInvoker.fetch() must throw an error");
      } catch (err) {
        false && console.log(JSON.stringify(err.payload));
        assert.equal(err.name, "RetryRecallOverLimit");
        assert.deepEqual(err.payload, {"step":4,"loop":3});
      }
    });

    it("loopFetch() exceeds the expired time must return the error: RetryRecallIsTimeout", async function() {
      const opts = {
        total: 6,
        delay: 5,
        timeout: 15,
        trappedCode: 201
      };
      //
      fetch.onCall(0).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(1).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(2).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(3).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(4).returns(Bluebird.resolve({ status: 201 }));
      fetch.onCall(5).returns(Bluebird.resolve({ status: 200 }));
      //
      try {
        const result = await restInvoker.fetch(url, args, opts);
        assert.fail("restInvoker.fetch() must throw an error");
      } catch (err) {
        false && console.log(JSON.stringify(err.payload));
        assert.equal(err.name, "RetryRecallIsTimeout");
        assert.isObject(err.payload);
        assert.property(err.payload, "now");
        assert.property(err.payload, "expiredTime");
        assert.isTrue(new Date(err.payload.expiredTime) < new Date(err.payload.now));
      }
    });
  });
});
