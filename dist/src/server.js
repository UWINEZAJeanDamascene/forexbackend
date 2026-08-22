"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const app = (0, app_1.createApp)();
(0, env_1.logEnvStatus)(env_1.env);
app.listen(env_1.env.port, () => {
    console.log(`[backend] listening on http://localhost:${env_1.env.port}`);
    console.log(`[backend] allowing requests from ${env_1.env.frontendUrl}`);
});
//# sourceMappingURL=server.js.map