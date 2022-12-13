'use strict';

const devebot = require('devebot');
const lodash = devebot.require('lodash');
const { assert, mockit } = require('liberica');
const { sanitizeUrlObject } = require("../../src/utils/url-toolkit");

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
      }
    ];

    for (const [index, tc] of testcases.entries()) {
      it(`sanitizeUrlObject with testcase [${tc.name}]`, function() {
        if (!tc.failed) {
          const result = sanitizeUrlObject(tc.sample.urlObject);
          false && console.log(result);
          assert.deepEqual(result, tc.output);
        }
      });
    }
  });
});
