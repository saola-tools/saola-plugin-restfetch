"use strict";

const Devebot = require("@saola/core");
const lodash = Devebot.require("lodash");

const DEFAULT_PORT_OF = {
  "ftp": "21",
  "http": "80",
  "https": "443",
  "ws": "80",
  "wss": "443",
};

function sanitizeUrlObject (urlObject, more) {
  const { strict } = more || {};
  //
  const UrlObjectError = lodash.get(more, "UrlObjectError", Error);
  //
  if (lodash.isString(urlObject.host)) {
    let [ hostname, port ] = urlObject.host.split(":");
    //
    if (urlObject.hostname && urlObject.hostname != hostname) {
      if (strict) {
        throw new UrlObjectError("urlObject.host is conflicted with urlObject.hostname");
      }
    }
    urlObject.hostname = urlObject.hostname || hostname;
    //
    let port1 = port && String(port) || DEFAULT_PORT_OF[urlObject.protocol];
    let port2 = urlObject.port && String(urlObject.port) || DEFAULT_PORT_OF[urlObject.protocol];
    if (port1 != port2) {
      if (strict) {
        throw new UrlObjectError("urlObject.host is conflicted with urlObject.port");
      }
    }
    urlObject.port = urlObject.port && String(urlObject.port) || port2;
    //
    urlObject.host = null;
  }
  //
  return urlObject;
}

function cleanDefaultPort (urlObject) {
  const defaultPort = DEFAULT_PORT_OF[urlObject.protocol];
  if (defaultPort && urlObject.port && defaultPort == String(urlObject.port)) {
    urlObject.port = null;
  }
  return urlObject;
}

module.exports = {
  cleanDefaultPort,
  sanitizeUrlObject,
  DEFAULT_PORT_OF,
};
