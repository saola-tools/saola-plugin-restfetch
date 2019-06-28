'use strict';

const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const fs = require('fs');
const path = require('path');
const traverse = require('traverse');

function Counselor(params = {}) {
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const mappings = {};

  const mappingStore = pluginCfg.mappingStore || pluginCfg.mappingFolder;
  const mappingScope = pluginCfg.mappingScope || pluginCfg.mappingBundle;
  if (lodash.isString(mappingStore)) {
    lodash.merge(mappings, sanitizeHttpHeaders(loadMappings(mappingStore, mappingScope)));
  }

  if (lodash.isObject(pluginCfg.mappings)) {
    lodash.merge(mappings, sanitizeHttpHeaders(pluginCfg.mappings));
  }

  Object.defineProperty(this, 'mappings', {
    get: function() {
      return mappings;
    },
    set: function(val) {}
  });
}

module.exports = Counselor;

function loadMappings(mappingSource, mappingBundle) {
  let mappings;
  const sourceStat = fs.statSync(mappingSource);
  if (sourceStat.isFile()) {
    const mappingScript = require(mappingSource);
    if (lodash.isFunction(mappingScript)) {
      mappings = mappingScript(mappingBundle);
    } else {
      mappings = mappingScript;
    }
  }
  if (sourceStat.isDirectory()) {
    mappings = {};
    const keys = lodash.map(filenameFilter(mappingSource, ['.js']), function(info) {
      return info.name;
    });
    lodash.forEach(keys, function(key) {
      let serviceName = chores.stringCamelCase(key);
      if (lodash.isString(mappingBundle) && mappingBundle.length > 0) {
        serviceName = mappingBundle + '/' + serviceName;
      }
      mappings[serviceName] = require(path.join(mappingSource, key + '.js'));
    });
  }
  return mappings;
}

function filenameFilter(dir, exts, fileinfos) {
  if (exts != null) {
    if (!lodash.isArray(exts)) {
      exts = [exts];
    }
  }
  fileinfos = fileinfos || [];
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    files = [];
  }
  for (const i in files) {
    const filename = dir + '/' + files[i];
    if (fs.statSync(filename).isFile()) {
      const fileinfo = path.parse(filename);
      if (exts == null || exts.indexOf(fileinfo.ext) >= 0) {
        fileinfos.push(lodash.pick(fileinfo, ["dir", "name", "ext"]));
      }
    }
  }
  return fileinfos;
}

function sanitizeHttpHeaders(mappings) {
  mappings = traverse(mappings).map(function (x) {
    if (this.key == 'headers') {
      var headers = this.node;
      headers = lodash.mapKeys(headers, function(v, k) {
        return unifyHttpHeaderName(k);
      });
      this.update(headers, true); // default: stopHere=false
    }
  });
  return mappings;
}

function unifyHttpHeaderName(name) {
  return lodash.capitalize(name.toLowerCase()).replace(/-([a-z])/g, function (m, w) {
    return '-' + w.toUpperCase();
  });
}
