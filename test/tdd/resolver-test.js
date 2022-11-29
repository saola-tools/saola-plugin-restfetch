'use strict';

const devebot = require('devebot');
const lodash = devebot.require('lodash');
const assert = require('liberica').assert;
const mockit = require('liberica').mockit;
const sinon = require('liberica').sinon;
const path = require('path');
const BusinessError = require('app-errorlist').BusinessError;

const libraryDir = "./../lib";

describe('resolver', function() {
  var app = require(path.join(__dirname, '../app'));
  var sandboxConfig = lodash.get(app.config, ['sandbox', 'default', 'plugins', 'appRestfetch']);

  describe('init()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    var services = {};
    var mappings = {
      "service_1": { "object": "#1" },
      "service_2": { "object": "#2" },
    };

    var Resolver, init, createService;

    beforeEach(function() {
      Resolver = mockit.acquire('resolver', { libraryDir });
      init = mockit.get(Resolver, 'init');
      createService = mockit.stub(Resolver, 'createService');
    });

    it('createService will not be called if enabled ~ false', function() {
      init(ctx, services, mappings, false);
      assert.equal(createService.callCount, 0);
    });

    it('createService will be called to initialize every service descriptors', function() {
      init(ctx, services, mappings);
      assert.equal(createService.callCount, lodash.keys(mappings).length);
    });

    it('createService will be passed the correct arguments with right order', function() {
      init(ctx, services, mappings);
      assert.equal(createService.callCount, lodash.keys(mappings).length);
      assert.isTrue(createService.getCall(0).calledWith(ctx, services, "service_1", { "object": "#1" }));
      assert.isTrue(createService.getCall(1).calledWith(ctx, services, "service_2", { "object": "#2" }));
    });
  });

  describe('createService()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    var services = {};
    var serviceName = "service_1";
    var serviceDescriptor = {};

    var Resolver, createService, registerMethod;

    beforeEach(function() {
      Resolver = mockit.acquire('resolver', { libraryDir });
      createService = mockit.get(Resolver, 'createService');
      registerMethod = mockit.stub(Resolver, 'registerMethod');
    });

    it('registerMethod will not be called if serviceDescriptor.enabled ~ false', function() {
      var serviceDescriptor = { enabled: false };
      createService(ctx, services, serviceName, serviceDescriptor);
      assert.equal(registerMethod.callCount, 0);
    });

    it('registerMethod will be passed the correct arguments with right order', function() {
      var serviceName = 'myService';
      var serviceDescriptor = {
        methods: {
          getUser: {
            note: 'This is the method#1'
          },
          getUserID: {
            note: 'This is the method#2'
          },
        }
      };

      createService(ctx, services, serviceName, serviceDescriptor);
      assert.equal(registerMethod.callCount, 2);
      assert.isTrue(registerMethod.getCall(0).calledWith(ctx, services[serviceName], 'getUser', serviceDescriptor.methods.getUser));
      assert.isTrue(registerMethod.getCall(1).calledWith(ctx, services[serviceName], 'getUserID', serviceDescriptor.methods.getUserID));
    });
  });

  describe('applyThroughput()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch/resolver',
    }

    var Resolver = mockit.acquire('resolver', { libraryDir });
    var applyThroughput = mockit.get(Resolver, 'applyThroughput');

    it('should create nothing if the parameters are not provided', function() {
      var box = applyThroughput(ctx, {});
      assert.isNull(box.ticketDeliveryDelay);
      assert.isNull(box.throughputValve);
    });

    it('should create the correct semaphore', function() {
      var box = applyThroughput(ctx, {
        throughputQuota: 2
      });
      assert.isObject(box.throughputValve);
      assert.equal(box.throughputValve.available, 2);
      assert.equal(box.throughputValve.capacity, 2);
      assert.equal(box.throughputValve.waiting, 0);
    });
  });

  describe('registerMethod()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var restInvoker = {
      fetch: sinon.stub()
    };
    var errorBuilder = {};
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
      BusinessError,
      errorBuilder,
      responseOptions: sandboxConfig.responseOptions,
      restInvoker,
    }

    var Resolver = mockit.acquire('resolver', { libraryDir });
    var registerMethod = mockit.get(Resolver, 'registerMethod');

    var target = {};
    var methodName = 'sendMail';
    var methodDescriptor = {};
    var methodContext = {};

    beforeEach(function() {
      restInvoker.fetch = sinon.stub()
    });

    it('skip register method if the methodDescriptor.enabled is false');

    it('must invoke the Transformer() constructor');

    it('must invoke the buildFetchArgs() function');

    it('skip the retry-loop if the waiting attribute is absent');

    it('skip the retry-loop if the waiting.enabled is false');

    it('must invoke the restInvoker.fetch() function', function() {
      var methodName = 'sendSMS';
      var methodDescriptor = {
        method: "GET",
        url: "http://api.twilio.com/v2/",
        arguments: {
          default: {
            query: {
              Accesskey: 'AABBCCDD', Type: 'EXT'
            }
          },
          transform: function(PhoneNumber, Text) {
            var q = {};
            if (PhoneNumber != null) {
              q.PhoneNumber = PhoneNumber;
            }
            if (Text != null) {
              q.Text = Text;
            }
            return { query: q }
          }
        }
      }
      var obj = registerMethod(ctx, target, methodName, methodDescriptor, methodContext);
      assert.equal(obj, target);
      assert.isFunction(obj.sendSMS);

      restInvoker.fetch.returns(Promise.resolve({
        headers: {
          get: function(headerName) {
            if (headerName === 'X-Return-Code') {
              return 0;
            }
            return undefined;
          }
        },
        json: function() {
          return {
            "message": "ok"
          }
        }
      }));

      return obj.sendSMS('0987654321', 'Hello world').then(function() {
        const fetchArgs = restInvoker.fetch.firstCall.args;
        assert.equal(fetchArgs.length, 3);
        assert.equal(fetchArgs[0], 'http://api.twilio.com/v2/?Accesskey=AABBCCDD&Type=EXT&PhoneNumber=0987654321&Text=Hello%20world');
        assert.deepEqual(fetchArgs[1], { "agent": null, "method": "GET", "headers": {} });
      });
    });

    it('must invoke the getTicket/releaseTicket function');

    it('must invoke F.transformArguments() method');

    it('must invoke F.transformResponse() method');

    it('must invoke F.transformException() method');
  });

  describe('buildFetchArgs()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    var methodContext = {
      urlObject: {
        protocol: 'https',
        hostname: 'api.github.com',
      },
      arguments: {
        default: {
          headers: {
            "Content-Type": "application/json"
          },
          query: {
            accessToken: 'abc.xyz:hello-world'
          }
        }
      }
    }

    var descriptor = {
      method: "GET",
      arguments: {
        default: {
          params: {
            owner: 'apporo',
            repoId: 'app-restfetch'
          },
          query: {
            accessToken: '1234567890'
          }
        }
      }
    }

    var methodArgs = {
      params: {
        owner: 'devebot',
        repoId: 'valvekit'
      },
      query: {
        accessToken: '0987654321',
        type: ['api', 'sms']
      }
    }

    var Resolver = mockit.acquire('resolver', { libraryDir });
    var buildFetchArgs = mockit.get(Resolver, 'buildFetchArgs');

    it('throw the Error if descriptor.method not found');

    it('throw the Error if both descriptor.url and descriptor.urlObject not found', function() {
      var fa = buildFetchArgs({}, { method: 'GET' }, methodArgs);
      assert.instanceOf(fa.error, Error);
      assert.isUndefined(fa.url);
      assert.isUndefined(fa.args);
    });

    it('build the fetch parameters from the arguments in which the pathname is undefined', function() {
      var methodDescriptor = lodash.clone(descriptor);
      var fa = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
      assert.isUndefined(fa.error);
      assert.equal(fa.url, 'https://api.github.com?accessToken=0987654321&type[]=api&type[]=sms');
      assert.deepEqual(fa.args, {
        agent: undefined,
        method: 'GET',
        headers: {
          "Content-Type": "application/json"
        }
      });
      assert.isUndefined(fa.timeout);
    });

    it('return the fetch parameters which built from the arguments of a method invocation', function() {
      var methodDescriptor = lodash.assign({
        urlObject: {
          pathname: '/repos/:owner/:repoId'
        }
      }, descriptor);
      var fa = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
      assert.isUndefined(fa.error);
      assert.equal(fa.url, 'https://api.github.com/repos/devebot/valvekit?accessToken=0987654321&type[]=api&type[]=sms');
      assert.deepEqual(fa.args, {
        agent: undefined,
        method: 'GET',
        headers: {
          "Content-Type": "application/json"
        }
      });
      assert.isUndefined(fa.timeout);
    });

    it('return the fetch parameters which built from the method arguments and default params of descriptor', function() {
      var methodDescriptor = lodash.assign({
        url: "https://api.github.com/repos/:owner/:repoId",
      }, descriptor);
      var methodArgs = {
        body: {
          orderId: 'ed441963-52b3-4981-ab83-6ea9eceb2213',
          name: 'PowerFan-W200'
        }
      }
      var fa = buildFetchArgs(methodContext, methodDescriptor, methodArgs);
      assert.isUndefined(fa.error);
      assert.equal(fa.url, 'https://api.github.com/repos/apporo/app-restfetch?accessToken=1234567890');
      if (lodash.isString(fa.args.body)) {
        fa.args.body = JSON.parse(fa.args.body);
      }
      assert.deepEqual(fa.args, {
        agent: undefined,
        method: 'GET',
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          orderId: 'ed441963-52b3-4981-ab83-6ea9eceb2213',
          name: 'PowerFan-W200'
        }
      });
      assert.isUndefined(fa.timeout);
    });
  });

  describe('getQueryString()', function() {
    var Resolver = mockit.acquire('resolver', { libraryDir });
    var getQueryString = mockit.get(Resolver, 'getQueryString');

    it('Create a query string properly', function() {
      assert.isEmpty(getQueryString({}));
      assert.equal(getQueryString({ abc: 123 }), "abc=123");
      assert.equal(getQueryString({ id: "Aw762Ytu", sort: true, limit: 10 }), "id=Aw762Ytu&sort=true&limit=10");
      assert.equal(getQueryString({ id: "A&762=tu", from: 10 }), "id=A%26762%3Dtu&from=10");
      //console.log("Result[%s]", getQueryString({ id: "A&762=tu", from: 10 }));
    })

    it('Create a query string properly', function() {
      assert.equal(getQueryString({ id: "Ae762Btu", color: ["red", "green", "blue"] }), "id=Ae762Btu&color[]=red&color[]=green&color[]=blue");
      assert.equal(getQueryString([]), '');
      assert.equal(getQueryString({ id: "Abcdk79", mobile: ["Nokia8", "SamSung=S9+", "LG66", "iphone8+"] }), "id=Abcdk79&mobile[]=Nokia8&mobile[]=SamSung%3DS9%2B&mobile[]=LG66&mobile[]=iphone8%2B");
      assert.equal(getQueryString({ numberchar: ["2<>3#$#", "abcd", "THX1138", "< >"] }), "numberchar[]=2%3C%3E3%23%24%23&numberchar[]=abcd&numberchar[]=THX1138&numberchar[]=%3C%20%3E");
      // console.log("Result[%s]", getQueryString({numberchar:["2<>3#$#","abcd","THX1138","< >"]}));
    });
  });

  describe('getTicket()/releaseTicket()', function() {
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }
    var box = {};

    var Resolver = mockit.acquire('resolver', { libraryDir });
    var getTicket = mockit.get(Resolver, 'getTicket');

    it('return default ticket if throughputValve is empty', function() {
      var ticket = getTicket(ctx);
      ticket.then(function(ticketId) {
        assert.isNotNull(ticketId);
        assert.equal(ticketId.length, 22);
      });
    });
  });
});
