'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('chai').assert;
var sinon = require('sinon');
var dtk = require('../index');

describe('counselor', function() {
  describe('unifyHttpHeaderName()', function() {
    var Counselor, unifyHttpHeaderName;

    beforeEach(function() {
      Counselor = dtk.acquire('counselor');
      unifyHttpHeaderName = Counselor.__get__('unifyHttpHeaderName');
    });

    it('unifyHttpHeaderName() will unify the names of HttpHeaders correctly', function() {
      assert.equal(unifyHttpHeaderName(''), '');
      assert.equal(unifyHttpHeaderName('CONTENT-TYPE'), 'Content-Type');
      assert.equal(unifyHttpHeaderName('x-access-token'), 'X-Access-Token');
      assert.equal(unifyHttpHeaderName('X-ACCESS-TOKEN'), 'X-Access-Token');
      assert.equal(unifyHttpHeaderName('x-request-id'), 'X-Request-Id');
      assert.equal(unifyHttpHeaderName('X-Request-ID'), 'X-Request-Id');
    });
  });

  describe('sanitizeHttpHeaders()', function() {
    var Counselor, sanitizeHttpHeaders;
    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    beforeEach(function() {
      Counselor = dtk.acquire('counselor');
      sanitizeHttpHeaders = Counselor.__get__('sanitizeHttpHeaders');
    });

    var mappings = {
      "restfetch-example/githubApi": {
        enabled: true,
        methods: {
          getListBranches: {
            method: "GET",
            url: "https://api.github.com/repos/:owner/:repoId/branches",
            arguments: {
              default: {
                headers: {
                  'content-type': 'application/json',
                  'x-access-token': 'A8Ytr54o0Mn',
                }
              },
              transform: function(owner, projectId) {
                var p = {};
                if (owner != null) {
                  p.owner = owner;
                }
                if (projectId != null) {
                  p.repoId = projectId;
                }
                return { params: p }
              }
            }
          },
          getProjectInfo: {
            method: "GET",
            url: "https://api.github.com/repos/:userOrOrgan/:projectId",
            arguments: {
              default: {
                params: {
                  userOrOrgan: 'apporo',
                  projectId: 'app-restfront'
                },
                query: {}
              },
              transform: function(data) {
                return data;
              }
            },
            response: {
              transform: function(res) {
                return res.json();
              }
            },
            exception: {
              transform: function(error) {
                return error;
              }
            }
          }
        }
      }
    }

    it('traverse configuration and sanitize the names of HttpHeaders', function() {
      var newHeaders = {
        'Content-Type': 'application/json',
        'X-Access-Token': 'A8Ytr54o0Mn',
      };
      var expected = lodash.set(lodash.cloneDeep(mappings), [
        "restfetch-example/githubApi", "methods", "getListBranches", "arguments", "default", "headers"
      ], newHeaders);

      var newMappings = sanitizeHttpHeaders(mappings);
      assert.notDeepEqual(newMappings, mappings);
      assert.deepEqual(newMappings, expected);

      assert.deepEqual(lodash.get(newMappings, [
        "restfetch-example/githubApi", "methods", "getListBranches", "arguments", "default", "headers"
      ]), newHeaders);
    });
  });
});
