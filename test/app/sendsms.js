'use strict';

var path = require('path');

var main = require('devebot').launchApplication({
  appRootPath: __dirname
}, [{
  name: 'app-restfetch',
  path: path.join(__dirname, '/../../index.js')
}]);

var resolver = main.runner.getSandboxService('app-restfetch/resolver');

var smsnhanh = resolver.lookupService("restfetch-example/smsnhanh");

smsnhanh.sendSMS('0582751038', 'Ban vua trung so doc dac 2').then(function(output) {
  console.log(JSON.stringify(output, null, 2));
})
