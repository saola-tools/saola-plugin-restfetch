module.exports = {
  plugins: {
    appRestfetch: {
      responseOptions: {
        returnCode: {
          headerName: 'X-Return-Code',
        }
      },
    }
  }
};
