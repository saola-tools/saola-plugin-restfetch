"use strict";

const Devebot = require("@saola/core");
const lodash = Devebot.require("lodash");
const assert = require("liberica").assert;
const mockit = require("liberica").mockit;
const sinon = require("liberica").sinon;
const path = require("path");
const BusinessError = require("@saola/plugin-errorlist").BusinessError;

const schemato = Devebot.require("schemato");
const validator = new schemato.Validator({ schemaVersion: 4 });

const libraryDir = "./../lib";

describe("resolver", function() {
  // const app = require(path.join(__dirname, "../app"));
  // const sandboxConfig = lodash.get(app.config, ["sandbox", "default", "plugins", "pluginRestfetch"]);
  // console.log(JSON.stringify(sandboxConfig, null, 2));
  //
  const sandboxConfig = {
    "throughputQuota": 1,
    "mappingStore": {
      "restfetch-example": "saola-plugin-restfetch/test/app/ext/mappings/targets"
    },
    "mappings": {
      "restfetch-example/gatekeeper": {
        "enabled": true
      }
    },
    "errorCodes": {
      "RequestTimeoutOnClient": {
        "message": "Client request timeout",
        "returnCode": 9001,
        "statusCode": 408
      },
      "RequestAbortedByClient": {
        "message": "Request was aborted by client",
        "returnCode": 9002,
        "statusCode": 408
      },
      "RetryRecallIsTimeout": {
        "message": "Retry request has timeout",
        "returnCode": 9005,
        "statusCode": 408
      },
      "RetryRecallOverLimit": {
        "message": "Retry request reachs limit",
        "returnCode": 9006,
        "statusCode": 408
      }
    },
    "responseOptions": {
      "returnCode": {
        "headerName": "X-Return-Code"
      }
    }
  };

  describe("constructor()", function() {
    const packageName = "@saola/plugin-restfetch";
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const sandboxConfig = {};
    const counselor = {
      mappings: {
        "restfetch-example/githubApi": {
          enabled: true,
          methods: {
            getListBranches: {
              method: "GET",
              url: "https://api.github.com/repos/:owner/:repoId/branches",
              urlObject: {
                protocol: "https",
                host: "api.github.com",
                hostname: "api.github.com"
              },
              arguments: {
                default: {
                  headers: {
                    "content-type": "application/json",
                    "x-access-token": "A8Ytr54o0Mn",
                  }
                }
              }
            },
            getProjectInfo: {
              method: "GET",
              url: "https://api.github.com/repos/:userOrOrgan/:projectId",
              arguments: {
                default: {
                  params: {
                    userOrOrgan: "apporo",
                    projectId: "app-restfront"
                  },
                  query: {}
                }
              }
            }
          }
        }
      }
    };

    const errorManager = {
      register: function(packageName, { errorConstructor, errorCodes } = {}) {
        return new ErrorBuilder({
          packageName, errorConstructor, errorCodes, defaultLanguage: "vi"
        });
      }
    };

    const ctx = { packageName, loggingFactory, sandboxConfig, counselor, errorManager };

    let Resolver, resolver;

    beforeEach(function() {
      Resolver = mockit.acquire("resolver", { libraryDir });
    });

    it("lookupService() should return a service object", function() {
      resolver = new Resolver(ctx);
      const service = resolver.lookupService("restfetch-example/githubApi");
      assert.isObject(service);
      assert.isFunction(service.getListBranches);
      assert.isFunction(service.getProjectInfo);
    });
  });

  function ErrorBuilder ({ packageName, errorConstructor, errorCodes, defaultLanguage }) {
    const packageRef = packageName;

    if (!(typeof errorConstructor === "function" && errorConstructor.prototype instanceof Error)) {
      errorConstructor = BusinessError;
    }
    errorCodes = errorCodes || {};

    this.newError = function(errorName, { payload, language } = {}) {
      language = language || defaultLanguage;
      const errInfo = errorCodes[errorName];
      if (errInfo == null) {
        return new errorConstructor(errorName, "Error[" + errorName + "] unsupported", {
          packageRef,
          returnCode: -1,
          statusCode: 500,
          payload: payload
        });
      }
      let msg = errInfo.message || errorName;
      if (errInfo.messageIn && typeof language === "string") {
        msg = errInfo.messageIn[language] || msg;
      }
      if (payload && typeof payload === "object") {
        msg = chores.formatTemplate(msg, payload);
      } else {
        payload = null;
      }
      return new errorConstructor(errorName, msg, {
        packageRef,
        returnCode: errInfo.returnCode,
        statusCode: errInfo.statusCode,
        payload: payload
      });
    };

    this.getDescriptor = function () {
      return { packageRef, errorConstructor, errorCodes, defaultLanguage };
    };
  }

  describe("init()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "@saola/plugin-restfetch",
    };

    const services = {};
    const mappings = {
      "service_1": { "object": "#1" },
      "service_2": { "object": "#2" },
    };

    let Resolver, init, createService;

    beforeEach(function() {
      Resolver = mockit.acquire("resolver", { libraryDir });
      init = mockit.get(Resolver, "init");
      createService = mockit.stub(Resolver, "createService");
    });

    it("createService will not be called if enabled ~ false", function() {
      init(ctx, services, mappings, false);
      assert.equal(createService.callCount, 0);
    });

    it("createService will be called to initialize every service descriptors", function() {
      init(ctx, services, mappings);
      assert.equal(createService.callCount, lodash.keys(mappings).length);
    });

    it("createService will be passed the correct arguments with right order", function() {
      init(ctx, services, mappings);
      assert.equal(createService.callCount, lodash.keys(mappings).length);
      assert.isTrue(createService.getCall(0).calledWith(ctx, services, "service_1", { "object": "#1" }));
      assert.isTrue(createService.getCall(1).calledWith(ctx, services, "service_2", { "object": "#2" }));
    });
  });

  describe("createService()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "@saola/plugin-restfetch",
    };

    const services = {};
    const serviceName = "service_1";

    let Resolver, createService, registerMethod;

    beforeEach(function() {
      Resolver = mockit.acquire("resolver", { libraryDir });
      createService = mockit.get(Resolver, "createService");
      registerMethod = mockit.stub(Resolver, "registerMethod");
    });

    it("registerMethod will not be called if serviceDescriptor.enabled ~ false", function() {
      const serviceDescriptor = { enabled: false };
      createService(ctx, services, serviceName, serviceDescriptor);
      assert.equal(registerMethod.callCount, 0);
    });

    it("registerMethod will be passed the correct arguments with right order", function() {
      const serviceName = "myService";
      const serviceDescriptor = {
        methods: {
          getUser: {
            note: "This is the method#1"
          },
          getUserID: {
            note: "This is the method#2"
          },
        }
      };

      createService(ctx, services, serviceName, serviceDescriptor);
      assert.equal(registerMethod.callCount, 2);
      assert.isTrue(registerMethod.getCall(0).calledWith(ctx, services[serviceName], "getUser", serviceDescriptor.methods.getUser));
      assert.isTrue(registerMethod.getCall(1).calledWith(ctx, services[serviceName], "getUserID", serviceDescriptor.methods.getUserID));
    });
  });

  describe("applyThroughput()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "@saola/plugin-restfetch/resolver",
    };

    let Resolver = mockit.acquire("resolver", { libraryDir });
    let applyThroughput = mockit.get(Resolver, "applyThroughput");

    it("should create nothing if the parameters are not provided", function() {
      const box = applyThroughput(ctx, {});
      assert.isNull(box.ticketDeliveryDelay);
      assert.isNull(box.throughputValve);
    });

    it("should create the correct semaphore", function() {
      const box = applyThroughput(ctx, {
        throughputQuota: 2
      });
      assert.isObject(box.throughputValve);
      assert.equal(box.throughputValve.available, 2);
      assert.equal(box.throughputValve.capacity, 2);
      assert.equal(box.throughputValve.waiting, 0);
    });
  });

  describe("registerMethod()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const restInvoker = {
      fetch: sinon.stub()
    };
    const errorBuilder = {};
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "@saola/plugin-restfetch",
      BusinessError,
      errorBuilder,
      responseOptions: sandboxConfig.responseOptions,
      restInvoker,
      validator,
    };

    let Resolver = mockit.acquire("resolver", { libraryDir });
    let registerMethod = mockit.get(Resolver, "registerMethod");

    const target = {};
    const methodName = "sendMail";
    const methodDescriptor = {};
    const methodContext = {};

    beforeEach(function() {
      restInvoker.fetch = sinon.stub();
    });

    it("skip register method if the methodDescriptor.enabled is false", function() {
      const target = {};
      const methodDescriptor = {
        enabled: false,
      };
      const obj = registerMethod(ctx, target, methodName, methodDescriptor, methodContext);
      assert.isEmpty(target);
    });

    it("must invoke the Transformer() constructor");

    it("must invoke the buildFetchArgs() function");

    it("skip the retry-loop if the waiting attribute is absent");

    it("skip the retry-loop if the waiting.enabled is false");

    it("must invoke the restInvoker.fetch() function", function() {
      const target = {};
      const methodName = "sendSMS";
      const methodDescriptor = {
        method: "GET",
        url: "http://api.twilio.com/v2/",
        arguments: {
          default: {
            query: {
              Accesskey: "AABBCCDD", Type: "EXT"
            }
          },
          transform: function(PhoneNumber, Text) {
            const q = {};
            if (PhoneNumber != null) {
              q.PhoneNumber = PhoneNumber;
            }
            if (Text != null) {
              q.Text = Text;
            }
            return { query: q };
          }
        }
      };
      const obj = registerMethod(ctx, target, methodName, methodDescriptor, methodContext);
      assert.equal(obj, target);
      assert.isFunction(obj.sendSMS);

      restInvoker.fetch.returns(Promise.resolve({
        headers: {
          get: function(headerName) {
            if (headerName === "X-Return-Code") {
              return 0;
            }
            return undefined;
          }
        },
        json: function() {
          return {
            "message": "ok"
          };
        }
      }));

      return obj.sendSMS("0987654321", "Hello world").then(function() {
        const fetchArgs = restInvoker.fetch.firstCall.args;
        assert.equal(fetchArgs.length, 3);
        assert.equal(fetchArgs[0], "http://api.twilio.com/v2/?Accesskey=AABBCCDD&Type=EXT&PhoneNumber=0987654321&Text=Hello%20world");
        assert.deepEqual(fetchArgs[1], { "agent": null, "method": "GET", "headers": {} });
      });
    });

    it("must process the failed response properly", async function() {
      const target = {};
      const methodName = "sendMMS";
      const methodDescriptor = {
        method: "GET",
        url: "http://api.twilio.com/v2/",
        arguments: {
          default: {
            query: { Accesskey: "AABBCCDD", Type: "EXT" }
          },
          transform: function(PhoneNumber, Text) {
            return { query: { PhoneNumber, Text } };
          }
        }
      };
      const obj = registerMethod(ctx, target, methodName, methodDescriptor, methodContext);
      assert.equal(obj, target);
      assert.isFunction(obj.sendMMS);

      restInvoker.fetch.returns(Promise.reject(new BusinessError("InvalidInputError", "Invalid input data")));

      try {
        await obj.sendMMS("0987654321", "Hello world");
      } catch (err) {
        assert.instanceOf(err, BusinessError);
      }
    });

    it("must invoke the getTicket/releaseTicket function");

    it("must invoke F.transformArguments() method");

    it("must invoke F.transformResponse() method");

    it("must invoke F.transformException() method");
  });

  describe("buildFetchArgs()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "@saola/plugin-restfetch",
    };

    const methodContext = {
      urlObject: {
        protocol: "https",
        hostname: "api.github.com",
      },
      arguments: {
        default: {
          headers: {
            "Content-Type": "application/json"
          },
          query: {
            accessToken: "abc.xyz:hello-world"
          }
        }
      }
    };

    const descriptor = {
      method: "GET",
      arguments: {
        default: {
          params: {
            owner: "apporo",
            repoId: "app-restfetch"
          },
          query: {
            accessToken: "1234567890"
          }
        }
      }
    };

    const methodArgs = {
      params: {
        owner: "Devebot",
        repoId: "valvekit"
      },
      query: {
        accessToken: "0987654321",
        type: ["api", "sms"]
      }
    };

    const Resolver = mockit.acquire("resolver", { libraryDir });
    const buildFetchArgs = mockit.get(Resolver, "buildFetchArgs");

    it("throw the Error if both descriptor.url and descriptor.urlObject not found", function() {
      const fa = buildFetchArgs({}, { method: "GET" }, methodArgs);
      assert.instanceOf(fa.error, Error);
      assert.isUndefined(fa.url);
      assert.isUndefined(fa.args);
    });

    it("throw the Error if descriptor.method is invalid", function() {
      const fa = buildFetchArgs({}, { method: true }, methodArgs);
      assert.instanceOf(fa.error, Error);
    });

    it("build the fetch parameters from the arguments in which the pathname is undefined", function() {
      const methodDescriptor = lodash.clone(descriptor);
      const fa = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
      assert.isUndefined(fa.error);
      assert.equal(fa.url, "https://api.github.com?accessToken=0987654321&type[]=api&type[]=sms");
      assert.deepEqual(fa.args, {
        agent: undefined,
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      assert.isUndefined(fa.timeout);
    });

    it("return the fetch parameters which built from the arguments of a method invocation", function() {
      const methodDescriptor = lodash.assign({
        urlObject: {
          pathname: "/repos/:owner/:repoId"
        }
      }, descriptor);
      const fa = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
      assert.isUndefined(fa.error);
      assert.equal(fa.url, "https://api.github.com/repos/Devebot/valvekit?accessToken=0987654321&type[]=api&type[]=sms");
      assert.deepEqual(fa.args, {
        agent: undefined,
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      assert.isUndefined(fa.timeout);
    });

    it("return the fetch parameters which built from the method arguments and default params of descriptor", function() {
      const methodDescriptor = lodash.assign({
        url: "https://api.github.com/repos/:owner/:repoId",
      }, descriptor);
      const methodArgs = {
        body: {
          orderId: "ed441963-52b3-4981-ab83-6ea9eceb2213",
          name: "PowerFan-W200"
        }
      };
      const fa = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
      assert.isUndefined(fa.error);
      assert.equal(fa.url, "https://api.github.com/repos/apporo/app-restfetch?accessToken=1234567890");
      if (lodash.isString(fa.args.body)) {
        fa.args.body = JSON.parse(fa.args.body);
      }
      assert.deepEqual(fa.args, {
        agent: undefined,
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          orderId: "ed441963-52b3-4981-ab83-6ea9eceb2213",
          name: "PowerFan-W200"
        }
      });
      assert.isUndefined(fa.timeout);
    });
  });

  describe("getQueryString()", function() {
    const Resolver = mockit.acquire("resolver", { libraryDir });
    const getQueryString = mockit.get(Resolver, "getQueryString");

    it("Create a query string properly", function() {
      assert.isEmpty(getQueryString({}));
      assert.equal(getQueryString({ abc: 123 }), "abc=123");
      assert.equal(getQueryString({ id: "Aw762Ytu", sort: true, limit: 10 }), "id=Aw762Ytu&sort=true&limit=10");
      assert.equal(getQueryString({ id: "A&762=tu", from: 10 }), "id=A%26762%3Dtu&from=10");
      //console.log("Result[%s]", getQueryString({ id: "A&762=tu", from: 10 }));
    });

    it("Create a query string properly", function() {
      assert.equal(getQueryString({ id: "Ae762Btu", color: ["red", "green", "blue"] }), "id=Ae762Btu&color[]=red&color[]=green&color[]=blue");
      assert.equal(getQueryString([]), "");
      assert.equal(getQueryString({ id: "Abcdk79", mobile: ["Nokia8", "SamSung=S9+", "LG66", "iphone8+"] }), "id=Abcdk79&mobile[]=Nokia8&mobile[]=SamSung%3DS9%2B&mobile[]=LG66&mobile[]=iphone8%2B");
      assert.equal(getQueryString({ numberchar: ["2<>3#$#", "abcd", "THX1138", "< >"] }), "numberchar[]=2%3C%3E3%23%24%23&numberchar[]=abcd&numberchar[]=THX1138&numberchar[]=%3C%20%3E");
      // console.log("Result[%s]", getQueryString({numberchar:["2<>3#$#","abcd","THX1138","< >"]}));
    });
  });

  describe("getTicket()/releaseTicket()", function() {
    const loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    const ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: "@saola/plugin-restfetch",
    };
    const box = {};

    const Resolver = mockit.acquire("resolver", { libraryDir });
    const getTicket = mockit.get(Resolver, "getTicket");

    it("return default ticket if throughputValve is empty", function() {
      const ticket = getTicket(ctx);
      ticket.then(function(ticketId) {
        assert.isNotNull(ticketId);
        assert.equal(ticketId.length, 22);
      });
    });
  });

  describe("buildFetchArgs()", function() {
    const methodContext = {
      arguments: {
        default: {
          headers: {
            "Content-Type": "application/json"
          },
          query: {
            accessToken: "abc.xyz:hello-world"
          }
        }
      }
    };

    const methodDescriptor = {
      hideDefaultPort: true,
      method: "GET",
      arguments: {
        default: {
          params: {
            owner: "apporo",
            repoId: "app-restfetch"
          },
          query: {
            accessToken: "1234567890"
          }
        }
      }
    };

    const methodArgs = {
      params: {
        owner: "Devebot",
        repoId: "valvekit"
      },
      query: {
        accessToken: "0987654321",
        type: ["api", "sms"]
      }
    };

    const Resolver = mockit.acquire("resolver", { libraryDir });
    const buildFetchArgs = mockit.get(Resolver, "buildFetchArgs");

    const samples = [
      {
        input: {
          context: methodContext,
          descriptor: lodash.assign({
            mixLinks: true,
            url: "http://example.com/api/v1",
            urlObject: {
              protocol: "https",
              hostname: "api.github.com",
              pathname: "/repos/:owner/:repoId",
            }
          }, methodDescriptor),
          args: methodArgs,
        },
        result: {
          url: "https://api.github.com/repos/Devebot/valvekit?accessToken=0987654321&type[]=api&type[]=sms",
        }
      },
      {
        input: {
          context: methodContext,
          descriptor: lodash.assign({
            mixLinks: true,
            url: "http://example.com/api/v1",
            urlObject: {
              protocol: "https",
              hostname: "api.github.com",
              pathname: "/repos/:owner/:repoId",
              port: "443",
            }
          }, methodDescriptor),
          args: methodArgs,
        },
        result: {
          url: "https://api.github.com/repos/Devebot/valvekit?accessToken=0987654321&type[]=api&type[]=sms",
        }
      }
    ];

    for (let [index, sample] of samples.entries()) {
      it("build the link testcase #" + index, function() {
        const { input, result } = sample;
        const fa = buildFetchArgs(input.context, input.descriptor, input.args);
        //
        assert.isUndefined(fa.error);
        assert.equal(fa.url, result.url);
      });
    }
  });
});
