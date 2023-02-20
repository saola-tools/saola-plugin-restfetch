module.exports = {
  plugins: {
    pluginRestfetch: {
      mappings: {
        "restfetch-example/gatekeeper": {
          enabled: true,
          urlObject: {
            host: "127.0.0.1:7979",
          }
        }
      }
    }
  }
};
