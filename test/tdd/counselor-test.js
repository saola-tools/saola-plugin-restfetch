'use strict';

const devebot = require('devebot');
const lodash = devebot.require('lodash');
const liberica = require('liberica');
const assert = liberica.assert;
const mockit = liberica.mockit;
const sinon = liberica.sinon;

const libraryDir = "./../lib";

describe('counselor', function() {
  describe('unifyHttpHeaderName()', function() {
    let Counselor, unifyHttpHeaderName;

    beforeEach(function() {
      Counselor = mockit.acquire('counselor', { libraryDir });
      unifyHttpHeaderName = mockit.get(Counselor, 'unifyHttpHeaderName');
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
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfetch',
    }

    beforeEach(function() {
      Counselor = mockit.acquire('counselor', { libraryDir });
      sanitizeHttpHeaders = mockit.get(Counselor, 'sanitizeHttpHeaders');
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
          getOrganization: {
            method: "GET",
            url: "https://api.github.com/org/:organId",
            arguments: {
              default: {
                headers: null,
              },
            },
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

  describe('Counselor() constructor', function() {
    /**
     * The Counselor constructor will load the fetch targets from the sandboxConfig.mappingStore files,
     * sanitize the headers in these mappings, then load the custom mappings from the sandboxConfig.mappings
     * and sanitize the headers in these mappings (if any) too.
     */
    var Counselor, mappingLoader;
    var loggingFactory = mockit.createLoggingFactoryMock({ captureMethodCall: false });
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
      Counselor = mockit.acquire('counselor', { libraryDir });
      mappingLoader = {
        loadMappings: sinon.stub()
      }
      mappingLoader.loadMappings.onFirstCall().returns(mockMappings);
      params.mappingLoader = mappingLoader;
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

      false && console.log("newMappings: %s", JSON.stringify(c.mappings, null, 2));
      assert.deepEqual(c.mappings, expected);
    });
  });
});
