"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = getHealth;
/**
 * GET /api/health
 * Simple liveness check. Used to verify the backend process is running
 * and reachable, independent of database/provider/AI status.
 */
function getHealth(_req, res) {
    res.status(200).json({ status: 'ok' });
}
//# sourceMappingURL=health.controller.js.map