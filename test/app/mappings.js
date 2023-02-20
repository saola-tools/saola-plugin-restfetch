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

const counselor = main.runner.getSandboxService("@saola/plugin-restfetch/counselor");
console.log(JSON.stringify(counselor.mappings, null, 2));
