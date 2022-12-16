"use strict";

var path = require("path");

var main = require("devebot").launchApplication({
  appRootPath: __dirname
}, [{
  name: "app-restfetch",
  path: path.join(__dirname, "/../../index.js")
}]);

var resolver = main.runner.getSandboxService("app-restfetch/resolver");

var gatekeeper = resolver.lookupService("restfetch-example/gatekeeper");

gatekeeper.updateUser({
  "appType":"agent",
  "phoneNumber":"+84987654321",
  "firstName":"Tran",
  "lastName":"Trung Truc"
}).then(function(output) {
  console.log(JSON.stringify(output, null, 2));
});
