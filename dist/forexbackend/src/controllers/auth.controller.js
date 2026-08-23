"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogin = requestLogin;
exports.verifyLogin = verifyLogin;
const emailAuthService_1 = require("../services/emailAuthService");
const historyAuth_1 = require("../middleware/historyAuth");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function requestLogin(req, res) {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    if (!EMAIL_PATTERN.test(email.trim())) {
        res.status(400).json({ error: 'A valid email address is required.' });
        return;
    }
    try {
        await (0, emailAuthService_1.requestEmailLogin)(email);
        res.status(202).json({ message: 'If that email can receive messages, a sign-in link has been sent.' });
    }
    catch (error) {
        res.status(503).json({ error: error instanceof Error ? error.message : 'Could not send sign-in email.' });
    }
}
async function verifyLogin(req, res) {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) {
        res.status(400).json({ error: 'A sign-in token is required.' });
        return;
    }
    const userId = await (0, emailAuthService_1.verifyEmailLogin)(token, req.historyUserId);
    if (!userId) {
        res.status(401).json({ error: 'This sign-in link is invalid, expired, or already used.' });
        return;
    }
    (0, historyAuth_1.setHistorySession)(res, userId);
    res.status(200).json({ message: 'Signed in successfully.' });
}
//# sourceMappingURL=auth.controller.js.map