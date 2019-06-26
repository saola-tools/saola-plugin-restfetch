'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('chai').assert;
var sinon = require('sinon');
var valvekit = require('valvekit');
var dtk = require('../index');

describe('resolver', function() {
  describe('init()', function() {
    var Resolver = dtk.acquire('resolver');
    var init = Resolver.__get__('init');
    var createService = sinon.stub();
    Resolver.__set__('createService', createService);

    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    it('createService will not be called if enabled ~ false', function() {
      var services = {};
      var mappings = {
        "service_1": {},
        "service_2": {},
      };
      init(ctx, services, mappings, false);
      assert.equal(createService.callCount, 0);
    });

    it('createService will be called to initialize every service descriptors', function() {
      var services = {};
      var mappings = {
        "service_1": {},
        "service_2": {},
      };
      init(ctx, services, mappings);
      assert.equal(createService.callCount, lodash.keys(mappings).length);
    });
  });

  describe('getTicket()/releaseTicket()', function() {
    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }
    var Resolver = dtk.acquire('resolver');
    var getTicket = Resolver.__get__('getTicket');

    it('return default ticket if throughputValve is empty', function() {
      var ticket = getTicket(ctx);
      ticket.then(function(ticketId) {
        assert.isNotNull(ticketId);
        assert.equal(ticketId.length, 22);
      });
    });
  })
});
