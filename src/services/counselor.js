'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const traverse = require('traverse');

function Counselor(params = {}) {
  const { sandboxConfig, mappingLoader } = params;
  const mappings = {};

  const mappingFromStore = mappingLoader.loadMappings(sandboxConfig.mappingStore, {
    fileFilter: mappingFileFilter,
    keyGenerator: idGenerator,
  });
  lodash.merge(mappings, sanitizeHttpHeaders(mappingFromStore));

  if (lodash.isObject(sandboxConfig.mappings)) {
    lodash.merge(mappings, sanitizeHttpHeaders(sandboxConfig.mappings));
  }

  Object.defineProperty(this, 'mappings', {
    get: function() {
      return mappings;
    },
    set: function(val) {}
  });
}

Counselor.referenceHash = {
  mappingLoader: 'devebot/mappingLoader'
};

module.exports = Counselor;

function idGenerator(mappingName, fileinfo) {
  if (fileinfo.standalone) {
    return null;
  }
  let serviceName = chores.stringCamelCase(fileinfo.name);
  if (lodash.isString(mappingName) && mappingName.length > 0) {
    serviceName = mappingName + '/' + serviceName;
  }
  return serviceName;
}

function mappingFileFilter(fileinfo) {
  return fileinfo.ext === '.js';
}

function sanitizeHttpHeaders(mappings) {
  mappings = traverse(mappings).map(function (x) {
    if (this.key == "headers") {
      let headers = this.node;
      if (lodash.isPlainObject(headers)) {
        headers = lodash.mapKeys(headers, function(v, k) {
          return unifyHttpHeaderName(k);
        });
        this.update(headers, true); // default: stopHere=false
      }
    }
  });
  return mappings;
}

function unifyHttpHeaderName(name) {
  return lodash.capitalize(name.toLowerCase()).replace(/-([a-z])/g, function (m, w) {
    return '-' + w.toUpperCase();
  });
}
