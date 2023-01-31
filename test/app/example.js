"use strict";

var path = require("path");

var main = require("devebot").launchApplication({
  appRootPath: __dirname
}, [{
  name: "app-restfetch",
  path: path.join(__dirname, "/../../index.js")
}]);

var resolver = main.runner.getSandboxService("app-restfetch/resolver");
var githubApi = resolver.lookupService("restfetch-example/githubApi");
githubApi.getListBranches("apporo","app-datastore").then(function(output) {
  console.log(JSON.stringify(output, null, 2));
});
