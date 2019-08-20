module.exports = {
  plugins: {
    appRestfetch: {
      errorCodes: {
        ClientRequestTimeout: {
          message: 'Client request timeout',
          returnCode: 201,
          statusCode: 408
        },
        RetryLoopIsTimeout: {
          message: 'Retry loop has timeout',
          returnCode: 202,
          statusCode: 408
        },
        RetryLoopOverLimit: {
          message: 'Retry loop has over limit',
          returnCode: 203,
          statusCode: 408
        },
      },
      responseOptions: {
        returnCode: {
          headerName: 'X-Return-Code',
        }
      },
    }
  }
};
