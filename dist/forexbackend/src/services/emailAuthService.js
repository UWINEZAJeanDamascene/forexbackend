"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestEmailLogin = requestEmailLogin;
exports.verifyEmailLogin = verifyEmailLogin;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../database/prisma");
const env_1 = require("../config/env");
const TOKEN_TTL_MS = 15 * 60 * 1000;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
async function requestEmailLogin(emailInput) {
    const email = normalizeEmail(emailInput);
    const user = await prisma_1.prisma.user.upsert({ where: { email }, update: {}, create: { email } });
    const token = crypto_1.default.randomBytes(32).toString('base64url');
    await prisma_1.prisma.emailLoginToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma_1.prisma.emailLoginToken.create({
        data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
    if (!env_1.env.resendApiKey || !env_1.env.authEmailFrom) {
        throw new Error('Email authentication is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.');
    }
    const loginUrl = `${env_1.env.frontendUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env_1.env.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: env_1.env.authEmailFrom,
            to: [email],
            subject: 'Sign in to Forex Analysis',
            text: `Open this link to sign in and access your analysis history:\n\n${loginUrl}\n\nThis link expires in 15 minutes.`,
        }),
    });
    if (!response.ok)
        throw new Error(`Resend rejected the login email with status ${response.status}.`);
}
async function verifyEmailLogin(token, anonymousUserId) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const loginToken = await tx.emailLoginToken.findUnique({ where: { tokenHash: hashToken(token) } });
        if (!loginToken || loginToken.usedAt || loginToken.expiresAt <= new Date())
            return null;
        const targetUserId = loginToken.userId;
        if (anonymousUserId !== targetUserId) {
            const sourceAnalyses = await tx.analysis.findMany({ where: { userId: anonymousUserId }, select: { id: true, snapshotKey: true } });
            const targetSnapshotKeys = new Set((await tx.analysis.findMany({ where: { userId: targetUserId, snapshotKey: { not: null } }, select: { snapshotKey: true } }))
                .map((analysis) => analysis.snapshotKey));
            for (const analysis of sourceAnalyses) {
                if (analysis.snapshotKey && targetSnapshotKeys.has(analysis.snapshotKey)) {
                    await tx.analysis.delete({ where: { id: analysis.id } });
                }
                else {
                    await tx.analysis.update({ where: { id: analysis.id }, data: { userId: targetUserId } });
                }
            }
            await tx.user.deleteMany({ where: { id: anonymousUserId, email: null } });
        }
        await tx.emailLoginToken.update({ where: { id: loginToken.id }, data: { usedAt: new Date() } });
        return targetUserId;
    });
}
//# sourceMappingURL=emailAuthService.js.map