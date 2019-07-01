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
      unifyHttpHeaderName = dtk.get(Counselor, 'unifyHttpHeaderName');
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
      sanitizeHttpHeaders = dtk.get(Counselor, 'sanitizeHttpHeaders');
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

  describe('loadMappings()', function() {
    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    var Counselor, loadMappings, fs;

    beforeEach(function() {
      Counselor = dtk.acquire('counselor');
      loadMappings = dtk.get(Counselor, 'loadMappings');
      fs = {
        statSync: sinon.stub()
      };
      dtk.set(Counselor, 'fs', fs);
    });
  });

  describe('Counselor() constructor', function() {
    var Counselor, loadMappings;
    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    var params = {
      sandboxConfig: {
        mappings: {
          "restfetch-example/githubApi": {
            enabled: false,
            methods: {
              getListBranches: {
                arguments: {
                  default: {
                    headers: {
                      'CONTENT-TYPE': 'text/plain',
                      'x-access-Token': '1111-1111',
                    }
                  }
                }
              }
            }
          }
        },
        mappingStore: {
          'restfetch-example': 'path-to-mappings-folder',
        }
      }
    }

    var mockMappings = {
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

    beforeEach(function() {
      Counselor = dtk.acquire('counselor');
      loadMappings = sinon.stub();
      loadMappings.onFirstCall().returns(mockMappings);
      dtk.set(Counselor, 'loadMappings', loadMappings);
    });

    it('Counselor will merge mappings properly', function() {
      var expected = lodash.cloneDeep(mockMappings);
      lodash.set(expected, [
        "restfetch-example/githubApi", "methods", "getListBranches", "arguments", "default", "headers"
      ], {
        'Content-Type': 'text/plain',
        'X-Access-Token': '1111-1111',
      });
      lodash.set(expected, ["restfetch-example/githubApi", "enabled"], false);

      var c = new Counselor(params);

      //console.log("newMappings: %s", JSON.stringify(c.mappings, null, 2));
      assert.deepEqual(c.mappings, expected);
    });
  });
});
