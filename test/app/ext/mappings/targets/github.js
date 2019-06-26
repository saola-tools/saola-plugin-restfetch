module.exports = {
  enabled: true,
  methods: {
    getListBranches: {
      url: "https://api.github.com/repos/:owner/:repoId/branches",
      method: "GET",
      transformInput: function(owner, projectId) {
        return {
          params: {
            owner: owner,
            repoId: projectId
          }
        }
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
