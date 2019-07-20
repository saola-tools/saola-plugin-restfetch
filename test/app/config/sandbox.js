module.exports = {
  plugins: {
    appRestfetch: {
      mappingStore: {
        'restfetch-example': require('path').join(__dirname, '../ext/mappings/targets')
      },
      mappings: {
        'restfetch-example/gatekeeper': {
          enabled: true
        }
      }
    }
  }
};
