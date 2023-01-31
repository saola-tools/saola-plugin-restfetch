module.exports = {
  plugins: {
    pluginRestfetch: {
      throughputQuota: 1,
      mappingStore: {
        "restfetch-example": require("path").join(__dirname, "../ext/mappings/targets")
      },
      mappings: {
        "restfetch-example/gatekeeper": {
          enabled: true
        }
      }
    }
  }
};
