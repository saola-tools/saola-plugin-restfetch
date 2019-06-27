module.exports = {
  plugins: {
    appRestfetch: {
      mappingScope: 'restfetch-example',
      mappingStore: require('path').join(__dirname, '../ext/mappings/targets')
    }
  }
};
