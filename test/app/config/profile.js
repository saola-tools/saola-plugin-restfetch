module.exports = {
  devebot: {
    coupling: 'loose',
    mode: 'silent'
  },
  logger: {
    transports: {
      console: {
        type: 'console',
        level: 'debug',
        json: false,
        timestamp: true,
        colorize: true
      }
    }
  }
};
