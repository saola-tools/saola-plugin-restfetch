"use strict";

const devebot = require("devebot");
const Bluebird = devebot.require("bluebird");
const assert = require("liberica").assert;
const mockit = require("liberica").mockit;
const path = require("path");

const moduleHome = path.join(__dirname, "../../lib/utils/");

describe("utils:rest-invoker", function() {
  const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });

  describe("this.fetch() method", function() {
    let RestInvoker = mockit.acquire("rest-invoker", { moduleHome });
    let restInvoker;
    let doFetch;
    let fetch;

    let url = "http://www.url.com";
    let args = {};

    beforeEach(function() {
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
  });
});
