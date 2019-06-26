module.exports = {
  enabled: true,
  methods: {
    getListBranches: {
      url: "https://api.github.com/repos/:owner/:repoId/branches",
      method: "GET",
      transformInput: function(owner, projectId) {
        var p = {};
        if (owner != null) {
          p.owner = owner;
        }
        if (projectId != null) {
          p.repoId = projectId;
        }
        return { params: p }
      }
    },
    getProjectInfo: {
      url: "https://api.github.com/repos/:userOrOrgan/:projectId",
      method: "GET",
      default: {
        params: {
          userOrOrgan: 'apporo',
          projectId: 'app-restfront'
        },
        query: {}
      },
      transformInput: function(data) {
        return data;
      },
      transformOutput: function(result) {
        return result;
      },
      transformError: function(error) {
        return error;
      }
    }
  }
}
