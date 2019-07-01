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

  let mappingStore = pluginCfg.mappingStore;
  if (lodash.isString(mappingStore)) {
    let store = {};
    store['app-restfetch'] = mappingStore;
    mappingStore = store;
  }
  if (lodash.isObject(mappingStore)) {
    lodash.forOwn(mappingStore, function(folder, bundle) {
      lodash.merge(mappings, sanitizeHttpHeaders(loadMappings(folder, bundle)));
    });
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

function loadMappings(mappingSource, serviceBundle) {
  let mappings;
  const sourceStat = fs.statSync(mappingSource);
  if (sourceStat.isFile()) {
    const mappingScript = require(mappingSource);
    if (lodash.isFunction(mappingScript)) {
      mappings = mappingScript(serviceBundle);
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
      if (lodash.isString(serviceBundle) && serviceBundle.length > 0) {
        serviceName = serviceBundle + '/' + serviceName;
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
  if (!lodash.isArray(fileinfos)) {
    fileinfos = [];
  }
  try {
    dir = path.normalize(dir);
    return filenameFilterDir(dir, dir, exts, fileinfos);
  } catch (err) {
    return fileinfos;
  }
}

function filenameFilterDir(homeDir, dir, exts, fileinfos = []) {
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const filename = path.join(dir, files[i]);
    const filestat = fs.statSync(filename);
    if (filestat.isDirectory()) {
      filenameFilterDir(homeDir, filename, exts, fileinfos);
    } else if (filestat.isFile()) {
      const fileinfo = path.parse(filename);
      if (exts == null || exts.indexOf(fileinfo.ext) >= 0) {
        fileinfos.push({
          home: homeDir,
          path: fileinfo.dir.slice(homeDir.length),
          dir: fileinfo.dir,
          base: fileinfo.base,
          name: fileinfo.name,
          ext: fileinfo.ext
        });
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
