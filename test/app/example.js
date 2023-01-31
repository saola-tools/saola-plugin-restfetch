"use strict";

const path = require("path");

const main = require("@saola/core").launchApplication({
  appRootPath: __dirname
}, [
  {
    name: "@saola/plugin-restfetch",
    path: path.join(__dirname, "/../../index.js")
  }
]);

const resolver = main.runner.getSandboxService("@saola/plugin-restfetch/resolver");
const githubApi = resolver.lookupService("restfetch-example/githubApi");
githubApi.getListBranches("apporo","app-datastore").then(function(output) {
  console.log(JSON.stringify(output, null, 2));
});
