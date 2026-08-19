"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const market_routes_1 = __importDefault(require("./routes/market.routes"));
const indicators_routes_1 = __importDefault(require("./routes/indicators.routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: env_1.env.frontendUrl,
    }));
    app.use(express_1.default.json());
    app.use('/api', health_routes_1.default);
    app.use('/api', market_routes_1.default);
    app.use('/api', indicators_routes_1.default);
    // Future routers (Phase 24 onward) will mount here, e.g.:
    // app.use('/api/analysis', analysisRoutes);
    // app.use('/api/backtest', backtestRoutes);
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found', path: req.originalUrl });
    });
    // Central error handler - never leak raw stack traces to clients.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err, _req, res, _next) => {
        console.error('[error]', err);
        res.status(500).json({ error: 'Internal server error' });
    });
    return app;
}
//# sourceMappingURL=app.js.map