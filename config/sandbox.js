module.exports = {
  plugins: {
    appRestfetch: {
      mappingStore: require('path').join(__dirname, '../ext/mappings')
    }
  }
};
