module.exports = {
  enabled: true,
  methods: {
    getListBranches: {
      method: "GET",
      url: "https://api.github.com:443/repos/:owner/:repoId/branches",
      throughputQuota: 1,
      ticketDeliveryDelay: 2000,
      arguments: {
        transform: function(owner, projectId) {
          var p = {};
          if (owner != null) {
            p.owner = owner;
          }
          if (projectId != null) {
            p.repoId = projectId;
          }
          return { params: p }
        }
      }
    },
    getProjectInfo: {
      method: "GET",
      url: "https://api.github.com:443/repos/:userOrOrgan/:projectId",
      arguments: {
        default: {
          params: {
            userOrOrgan: 'apporo',
            projectId: 'app-restfront'
          },
          query: {}
        },
        transform: function(data) {
          return data;
        }
      },
      response: {
        transform: function(res) {
          return res.json();
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
