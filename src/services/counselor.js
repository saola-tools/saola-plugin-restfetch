"use strict";

const Devebot = require("devebot");
const chores = Devebot.require("chores");
const lodash = Devebot.require("lodash");
const traverse = require("traverse");

const { sanitizeUrlObject } = require("../utils/url-toolkit");

function Counselor (params = {}) {
  const { sandboxConfig, mappingLoader } = params;
  let mappings = {};

  const mappingFromStore = mappingLoader.loadMappings(sandboxConfig.mappingStore, {
    fileFilter: mappingFileFilter,
    keyGenerator: idGenerator,
  });
  lodash.merge(mappings, sanitizeHttpHeaders(mappingFromStore));

  if (lodash.isObject(sandboxConfig.mappings)) {
    lodash.merge(mappings, sanitizeHttpHeaders(sandboxConfig.mappings));
  }

  mappings = sanitizeMappings(mappings);

  Object.defineProperty(this, "mappings", {
    get: function() {
      return mappings;
    },
    set: function(val) {}
  });
}

Counselor.referenceHash = {
  mappingLoader: "devebot/mappingLoader"
};

module.exports = Counselor;

function idGenerator (mappingName, fileinfo) {
  if (fileinfo.standalone) {
    return null;
  }
  let serviceName = chores.stringCamelCase(fileinfo.name);
  if (lodash.isString(mappingName) && mappingName.length > 0) {
    serviceName = mappingName + "/" + serviceName;
  }
  return serviceName;
}

function mappingFileFilter (fileinfo) {
  return fileinfo.ext === ".js";
}

function sanitizeHttpHeaders (mappings) {
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

function unifyHttpHeaderName (name) {
  return lodash.capitalize(name.toLowerCase()).replace(/-([a-z])/g, function (m, w) {
    return "-" + w.toUpperCase();
  });
}

function sanitizeMappings (mappings) {
  const errors = [];
  mappings = traverse(mappings).map(function (x) {
    if (this.key == "urlObject") {
      let urlObject = this.node;
      if (lodash.isPlainObject(urlObject)) {
        try {
          urlObject = sanitizeUrlObject(urlObject);
          this.update(urlObject, true); // default: stopHere=false
        } catch (error) {
          errors.push({
            path: this.path,
            error: error
          });
        }
      }
    }
  });
  return mappings;
}
