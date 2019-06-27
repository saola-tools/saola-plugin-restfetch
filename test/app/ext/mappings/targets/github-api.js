module.exports = {
  enabled: true,
  methods: {
    getListBranches: {
      method: "GET",
      url: "https://api.github.com/repos/:owner/:repoId/branches",
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
      url: "https://api.github.com/repos/:userOrOrgan/:projectId",
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
