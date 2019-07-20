'use strict';

module.exports = {
  enabled: true,
  methods: {
    updateUser: {
      method: "POST",
      url: "http://localhost:7979/handshake/auth/update-user",
      arguments: {
        transform: function(data) {
          console.log('===before [updateUser]: %s', JSON.stringify(data));
          return {
            body: data
          };
        }
      },
      response: {
        transform: function(res) {
          var obj = res.json();
          console.log('===after [updateUser]: %s', JSON.stringify(obj));
          return obj;
        }
      },
      exception: {
        transform: function(error) {
          return error;
        }
      }
    }
  }
}
