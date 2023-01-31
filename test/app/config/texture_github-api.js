const lodash = require('lodash');

module.exports = {
  application: {
    services: {
      githubApi: {
        methods: {
          getListBranches: {
            mocking: {
              mappings: {
                "unsupported": {
                  selector: function() {
                    return true;
                  },
                  generate: function(data = {}) {
                    console.log("SMS: %s", JSON.stringify(data));
                    return {
                      "code": "unsupported"
                    }
                  }
                }
              }
            }
          },
          getProjectInfo: {
            mocking: {
              mappings: {
                "unsupported": {
                  selector: function() {
                    return true;
                  },
                  generate: function() {
                    return {
                      "code": "unsupported"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}