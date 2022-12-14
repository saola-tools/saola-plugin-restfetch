"use strict";

const devebot = require("devebot");
const lodash = devebot.require("lodash");
const liberica = require("liberica");
const assert = liberica.assert;
const mockit = liberica.mockit;
const sinon = liberica.sinon;

const libraryDir = "./../lib";

describe("counselor", function() {
  describe("unifyHttpHeaderName()", function() {
    let Counselor, unifyHttpHeaderName;

    beforeEach(function() {
      Counselor = mockit.acquire("counselor", { libraryDir });
      unifyHttpHeaderName = mockit.get(Counselor, "unifyHttpHeaderName");
    });

    it("unifyHttpHeaderName() will unify the names of HttpHeaders correctly", function() {
      assert.equal(unifyHttpHeaderName(""), "");
      assert.equal(unifyHttpHeaderName("CONTENT-TYPE"), "Content-Type");
      assert.equal(unifyHttpHeaderName("x-access-token"), "X-Access-Token");
      assert.equal(unifyHttpHeaderName("X-ACCESS-TOKEN"), "X-Access-Token");
      assert.equal(unifyHttpHeaderName("x-request-id"), "X-Request-Id");
      assert.equal(unifyHttpHeaderName("X-Request-ID"), "X-Request-Id");
    });
  });

  describe("sanitizeHttpHeaders()", function() {
    let Counselor, sanitizeHttpHeaders;

    beforeEach(function() {
      Counselor = mockit.acquire("counselor", { libraryDir });
      sanitizeHttpHeaders = mockit.get(Counselor, "sanitizeHttpHeaders");
    });

    const mappings = {
      "restfetch-example/githubApi": {
        enabled: true,
        methods: {
          getListBranches: {
            method: "GET",
            url: "https://api.github.com/repos/:owner/:repoId/branches",
            arguments: {
              default: {
                headers: {
                  "content-type": "application/json",
                  "x-access-token": "A8Ytr54o0Mn",
                }
              },
              transform: function(owner, projectId) {
                const p = {};
                if (owner != null) {
                  p.owner = owner;
                }
                if (projectId != null) {
                  p.repoId = projectId;
                }
                return { params: p };
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
                  userOrOrgan: "apporo",
                  projectId: "app-restfront"
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
    };

    it("traverse configuration and sanitize the names of HttpHeaders", function() {
      const newHeaders = {
        "Content-Type": "application/json",
        "X-Access-Token": "A8Ytr54o0Mn",
      };
      const expected = lodash.set(lodash.cloneDeep(mappings), [
        "restfetch-example/githubApi", "methods", "getListBranches", "arguments", "default", "headers"
      ], newHeaders);

      const newMappings = sanitizeHttpHeaders(mappings);
      assert.notDeepEqual(newMappings, mappings);
      assert.deepEqual(newMappings, expected);

      assert.deepEqual(lodash.get(newMappings, [
        "restfetch-example/githubApi", "methods", "getListBranches", "arguments", "default", "headers"
      ]), newHeaders);
    });
  });

  describe("Counselor() constructor", function() {
    /**
     * The Counselor constructor will load the fetch targets from the sandboxConfig.mappingStore files,
     * sanitize the headers in these mappings, then load the custom mappings from the sandboxConfig.mappings
     * and sanitize the headers in these mappings (if any) too.
     */
    let Counselor, mappingLoader;

    const params = {
      sandboxConfig: {
        mappings: {
          "restfetch-example/githubApi": {
            enabled: false,
            methods: {
              getListBranches: {
                arguments: {
                  default: {
                    headers: {
                      "CONTENT-TYPE": "text/plain",
                      "x-access-Token": "1111-1111",
                    }
                  }
                }
              }
            }
          }
        },
        mappingStore: {
          "restfetch-example": "path-to-mappings-folder",
        }
      }
    };

    const mockMappings = {
      "restfetch-example/githubApi": {
        enabled: true,
        methods: {
          getListBranches: {
            method: "GET",
            url: "https://api.github.com/repos/:owner/:repoId/branches",
            arguments: {
              default: {
                headers: {
                  "content-type": "application/json",
                  "x-access-token": "A8Ytr54o0Mn",
                }
              },
              transform: function(owner, projectId) {
                const p = {};
                if (owner != null) {
                  p.owner = owner;
                }
                if (projectId != null) {
                  p.repoId = projectId;
                }
                return { params: p };
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
    };

    beforeEach(function() {
      Counselor = mockit.acquire("counselor", { libraryDir });
      mappingLoader = {
        loadMappings: sinon.stub()
      };
      mappingLoader.loadMappings.onFirstCall().returns(mockMappings);
      params.mappingLoader = mappingLoader;
    });

    it("Counselor will merge mappings properly", function() {
      const expected = lodash.cloneDeep(mockMappings);
      lodash.set(expected, [
        "restfetch-example/githubApi", "methods", "getListBranches", "arguments", "default", "headers"
      ], {
        "Content-Type": "text/plain",
        "X-Access-Token": "1111-1111",
      });
      lodash.set(expected, ["restfetch-example/githubApi", "enabled"], false);

      const c = new Counselor(params);

      false && console.log("newMappings: %s", JSON.stringify(c.mappings, null, 2));
      assert.deepEqual(c.mappings, expected);
    });
  });

  describe("idGenerator()", function() {
    let Counselor, idGenerator;

    beforeEach(function() {
      Counselor = mockit.acquire("counselor", { libraryDir });
      idGenerator = mockit.get(Counselor, "idGenerator");
    });

    it("idGenerator() will return null if fileinfo contains the [standalone] property", function() {
      assert.isNull(idGenerator("my-mapping", { standalone: true }));
    });

    it("idGenerator() will return a service reference ID properly", function() {
      assert.equal(idGenerator("my-mapping", { name: "restfront-api" }), "my-mapping/restfrontApi");
    });
  });

  describe("sanitizeMappings()", function() {
    let Counselor, sanitizeMappings;

    const exampleMappings = {
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
    };

    const expected = lodash.cloneDeep(exampleMappings);
    lodash.set(expected, ["restfetch-example/githubApi", "methods", "getListBranches", "urlObject"], {
      "protocol": "https",
      "host": null,
      "hostname": "api.github.com",
      "port": "443"
    });

    beforeEach(function() {
      Counselor = mockit.acquire("counselor", { libraryDir });
      sanitizeMappings = mockit.get(Counselor, "sanitizeMappings");
    });

    it("sanitizeMappings() will sanitize the urlObject properly", function() {
      const result = sanitizeMappings(exampleMappings);
      false && console.log(JSON.stringify(result, null, 2));
      assert.deepEqual(result, expected);
    });
  });
});
