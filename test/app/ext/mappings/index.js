'use strict';

const targetBundle = "restfetch-example";

const devebot = require('devebot');
const lodash = devebot.require('lodash');
const path = require('path');

const settings = {};

lodash.forEach(['github'], function(key) {
  const serviceName = targetBundle + '/' + key;
  settings[serviceName] = require(path.join(__dirname, 'targets', key + '.js'));
})

module.exports = settings;
