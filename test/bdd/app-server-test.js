"use strict";

const Devebot = require("@saola/core");
const chores = Devebot.require("chores");

const app = require("../app");

describe("@saola/plugin-restfetch", function() {
  describe("start/stop app.server", function() {
    before(function() {
      chores.setEnvironments({
        SAOLA_FORCING_SILENT: "framework",
        LOGOLITE_FULL_LOG_MODE: "false",
        LOGOLITE_ALWAYS_ENABLED: "all",
        LOGOLITE_ALWAYS_MUTED: "all"
      });
    });
    //
    after(function() {
      chores.clearCache();
    });
    //
    it("app.server should be started/stopped properly", function() {
      return app.server.start().then(function() {
        return app.server.stop();
      });
    });
  });
});
