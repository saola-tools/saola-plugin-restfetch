module.exports = {
  plugins: {
    appRestfetch: {
      errorCodes: {
        RequestTimeoutOnClient: {
          message: 'Client request timeout',
          returnCode: 9001,
          statusCode: 408
        },
        RequestAbortedByClient: {
          message: 'Request was aborted by client',
          returnCode: 9002,
          statusCode: 408
        },
        RetryLoopIsTimeout: {
          message: 'Retry loop has timeout',
          returnCode: 9005,
          statusCode: 408
        },
        RetryLoopOverLimit: {
          message: 'Retry loop has over limit',
          returnCode: 9006,
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
