'use strict';

const assert = require('assert');
const Devebot = require('devebot');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const fs = require('fs');
const path = require('path');
const traverse = require('traverse');

const BUILTIN_MAPPING_LOADER = chores.isVersionLTE && chores.getVersionOf &&
    chores.isVersionLTE("0.3.1", chores.getVersionOf("devebot"));

function Counselor(params = {}) {
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const mappings = {};

  if (BUILTIN_MAPPING_LOADER) {
    const mappingFromStore = params.mappingLoader.loadMappings(pluginCfg.mappingStore, {
      fileFilter: mappingFileFilter,
      keyGenerator: idGenerator,
    });
    lodash.merge(mappings, sanitizeHttpHeaders(mappingFromStore));
  } else {
    lodash.merge(mappings, sanitizeHttpHeaders(loadMappings(pluginCfg.mappingStore)));
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

if (BUILTIN_MAPPING_LOADER) {
  Counselor.referenceHash = {
    mappingLoader: 'devebot/mappingLoader'
  };
}

module.exports = Counselor;

// ----------------------------------------------------------------------------

function loadMappings(mappingStore) {
  const mappings = {};
  if (lodash.isString(mappingStore)) {
    let store = {};
    store['app-restfetch'] = mappingStore;
    mappingStore = store;
  }
  if (lodash.isObject(mappingStore)) {
    lodash.forOwn(mappingStore, function(path, name) {
      lodash.merge(mappings, loadMappingStore(path, name, idGenerator));
    });
  }
  return mappings;
}

function loadMappingStore(mappingPath, mappingName, keyGenerator, evaluated) {
  if (!lodash.isFunction(keyGenerator)) {
    keyGenerator = function(mappingName, fileInfo, fileBody) {
      return mappingName;
    }
  }
  let mappings;
  let mappingStat;
  try {
    mappingStat = fs.statSync(mappingPath);
  } catch (err) {
    mappingPath = mappingPath + '.js';
    try {
      mappingStat = fs.statSync(mappingPath);
    } catch (e__) {
      throw err;
    }
  }
  if (mappingStat.isFile()) {
    mappings = evaluateMappingFile(mappingPath, mappingName, evaluated);
  }
  if (mappingStat.isDirectory()) {
    mappings = {};
    const fileinfos = traverseDir(mappingPath, mappingFileFilter);
    lodash.forEach(fileinfos, function(info) {
      const mappingFile = path.join(info.dir, info.base);
      const fileBody = evaluateMappingFile(mappingFile, mappingName, evaluated);
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

function evaluateMappingFile(mappingPath, mappingName, evaluated) {
  const mappingBody = requireMappingFile(mappingPath);
  if (lodash.isFunction(mappingBody) && evaluated !== false) {
    try {
      return mappingBody(mappingName);
    } catch (err) {}
  }
  return mappingBody;
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
    let exts = filter;
    if (exts != null) {
      if (lodash.isRegExp(exts)) {
        filter = function (fileinfo) {
          if (fileinfo == null) return true;
          return exts.test(path.join(fileinfo.path, fileinfo.base));
        }
      } else {
        if (!lodash.isArray(exts)) {
          exts = [exts];
        }
        filter = function (fileinfo) {
          if (fileinfo == null) return true;
          for(const i in exts) {
            const ext = exts[i];
            const filepath = path.join(fileinfo.path, fileinfo.base);
            if (filepath.indexOf(ext.toString()) >= 0) {
              return true;
            }
          }
          return false;
        }
      }
    }
  }
  if (!lodash.isArray(fileinfos)) {
    fileinfos = [];
  }
  try {
    dir = path.normalize(dir);
    if (dir && dir !== path.sep && dir.length > 1 && dir.endsWith(path.sep)) {
      dir = dir.substring(0, dir.length - 1);
    }
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

// ----------------------------------------------------------------------------

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
