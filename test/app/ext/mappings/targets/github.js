module.exports = {
  enabled: true,
  methods: {
    getListBranches: {
      url: "https://api.github.com/repos/:owner/:repoId/branches",
      method: "GET"
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
      transformData: function(data) {
        return data;
      },
      transformResult: function(result) {
        return result;
      },
      transformError: function(error) {
        return error;
      }
    }
  }
}
