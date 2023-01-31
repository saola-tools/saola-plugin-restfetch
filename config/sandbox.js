module.exports = {
  plugins: {
    pluginRestfetch: {
      errorCodes: {
        RequestTimeoutOnClient: {
          message: "Client request timeout",
          returnCode: 9001,
          statusCode: 408
        },
        RequestAbortedByClient: {
          message: "Request was aborted by client",
          returnCode: 9002,
          statusCode: 408
        },
        RetryRecallIsTimeout: {
          message: "Retry request has timeout",
          returnCode: 9005,
          statusCode: 408
        },
        RetryRecallOverLimit: {
          message: "Retry request reachs limit",
          returnCode: 9006,
          statusCode: 408
        },
      },
      responseOptions: {
        returnCode: {
          headerName: "X-Return-Code",
        }
      },
    }
  }
};
