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

const gatekeeper = resolver.lookupService("restfetch-example/gatekeeper");

gatekeeper.updateUser({
  "appType":"agent",
  "phoneNumber":"+84987654321",
  "firstName":"Tran",
  "lastName":"Trung Truc"
}).then(function(output) {
  console.log(JSON.stringify(output, null, 2));
});
