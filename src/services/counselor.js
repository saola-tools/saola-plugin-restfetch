'use strict';

const assert = require('assert');
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
    lodash.forOwn(mappingStore, function(path, name) {
      lodash.merge(mappings, sanitizeHttpHeaders(loadMappingStore(path, name, idGenerator)));
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

function loadMappingStore(mappingPath, mappingName, keyGenerator) {
  if (!lodash.isFunction(keyGenerator)) {
    keyGenerator = function(mappingName, fileInfo, fileBody) {
      return mappingName;
    }
  }
  let mappings;
  const mappingStat = fs.statSync(mappingPath);
  if (mappingStat.isFile()) {
    const mappingScript = requireMappingFile(mappingPath);
    if (lodash.isFunction(mappingScript)) {
      mappings = mappingScript(mappingName);
    } else {
      mappings = mappingScript;
    }
  }
  if (mappingStat.isDirectory()) {
    mappings = {};
    const fileinfos = traverseDir(mappingPath, mappingFileFilter);
    lodash.forEach(fileinfos, function(info) {
      const fileBody = requireMappingFile(path.join(info.dir, info.base));
      const mappingId = keyGenerator(mappingName, info, fileBody);
      mappings[mappingId] = fileBody;
    });
  }
  return mappings;
}

function idGenerator(mappingName, fileinfo) {
  let serviceName = chores.stringCamelCase(fileinfo.name);
  if (lodash.isString(mappingName) && mappingName.length > 0) {
    serviceName = mappingName + '/' + serviceName;
  }
  return serviceName;
}

function mappingFileFilter(fileinfo) {
  return fileinfo.ext === '.js';
}

function requireMappingFile(mappingFile) {
  try {
    return require(mappingFile);
  } catch (err) {
    return null;
  }
}

function traverseDir(dir, filter, fileinfos) {
  if (!lodash.isFunction(filter)) {
    const exts = filter;
    if (exts != null) {
      if (lodash.isRegExp(exts)) {
        filter = function (fileinfo) {
          return fileinfo != null && exts.test(fileinfo.ext);
        }
      } else if (lodash.isArray(exts)) {
        filter = function (fileinfo) {
          return fileinfo && exts.indexOf(fileinfo.ext) >= 0;
        }
      } else {
        filter = function (fileinfo) {
          return fileinfo && fileinfo.ext == exts;
        }
      }
    }
  }
  if (!lodash.isArray(fileinfos)) {
    fileinfos = [];
  }
  try {
    dir = path.normalize(dir);
    return traverseDirRecursively(dir, dir, filter, fileinfos);
  } catch (err) {
    return fileinfos;
  }
}

function traverseDirRecursively(homeDir, dir, filter, fileinfos = []) {
  assert.ok(filter == null || lodash.isFunction(filter));
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const filename = path.join(dir, files[i]);
    const filestat = fs.statSync(filename);
    if (filestat.isDirectory()) {
      traverseDirRecursively(homeDir, filename, filter, fileinfos);
    } else if (filestat.isFile()) {
      const fileinfo = path.parse(filename);
      if (filter == null || filter(fileinfo)) {
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
