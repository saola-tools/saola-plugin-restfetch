'use strict';

const devebot = require('devebot');
const chores = devebot.require('chores');
const lodash = devebot.require('lodash');
const path = require('path');

module.exports = function(targetBundle) {
  const mappings = {};
  lodash.forEach(['github-api'], function(key) {
    const serviceName = targetBundle + '/' + chores.stringCamelCase(key);
    mappings[serviceName] = require(path.join(__dirname, 'targets', key + '.js'));
  });
  return mappings;
}
