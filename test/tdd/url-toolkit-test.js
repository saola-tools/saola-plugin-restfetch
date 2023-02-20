'use strict';

const Devebot = require('@saola/core');
const lodash = Devebot.require('lodash');
const { assert } = require('liberica');
const { sanitizeUrlObject } = require("../../lib/utils/url-toolkit");

describe('utils:url-toolkit', function() {
  describe('sanitizeUrlObject()', function() {
    const testcases = [
      {
        "name": "Case normal 01",
        "failed": false,
        "sample": {
          "urlObject": {
            "host": "example.com",
          }
        },
        "output": {
          "host": null,
          "hostname": "example.com",
          "port": undefined,
        }
      },
      {
        "name": "Case normal 02",
        "failed": false,
        "sample": {
          "urlObject": {
            "host": "example.com",
            "hostname": "example.com",
          }
        },
        "output": {
          "host": null,
          "hostname": "example.com",
          "port": undefined,
        }
      },
      {
        "name": "Case normal 03",
        "failed": false,
        "sample": {
          "urlObject": {
            "host": "example.com",
            "hostname": "sample.com",
          }
        },
        "output": {
          "host": null,
          "hostname": "sample.com",
          "port": undefined,
        }
      },
      {
        "name": "Case normal 04",
        "failed": false,
        "sample": {
          "urlObject": {
            "host": "example.com:443",
            "hostname": "sample.com",
            "port": 80
          }
        },
        "output": {
          "host": null,
          "hostname": "sample.com",
          "port": "80",
        }
      },
      {
        "name": "Case normal 05",
        "failed": false,
        "sample": {
          "urlObject": {
            "host": "example.com:7979",
            "hostname": "sample.com"
          }
        },
        "output": {
          "host": null,
          "hostname": "sample.com",
          "port": "7979",
        }
      },
      {
        "name": "Case strict 01",
        "failed": true,
        "sample": {
          "urlObject": {
            "host": "example.com:443",
            "hostname": "sample.com",
            "port": 443
          },
          "more": {
            "strict": true
          }
        }
      },
      {
        "name": "Case strict 02",
        "failed": true,
        "sample": {
          "urlObject": {
            "protocol": "https",
            "host": "example.com",
            "hostname": "example.com",
            "port": 80
          },
          "more": {
            "strict": true
          }
        }
      },
      {
        "name": "Case strict 03",
        "failed": false,
        "sample": {
          "urlObject": {
            "protocol": "http",
            "host": "example.com",
            "hostname": "example.com",
            "port": 80
          },
          "more": {
            "strict": true
          }
        },
        "output": {
          "protocol": "http",
          "host": null,
          "hostname": "example.com",
          "port": "80",
        }
      }
    ];

    for (const [index, tc] of testcases.entries()) {
      it(`sanitizeUrlObject with testcase [${tc.name}]`, function() {
        if (!tc.failed) {
          const result = sanitizeUrlObject(tc.sample.urlObject, tc.sample.more);
          false && console.log(result);
          assert.deepEqual(result, tc.output);
        } else {
          assert.throws(function() {
            sanitizeUrlObject(tc.sample.urlObject, tc.sample.more);
          }, Error)
        }
      });
    }
  });
});
