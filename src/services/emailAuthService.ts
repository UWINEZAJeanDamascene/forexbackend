import crypto from 'crypto';
import { prisma } from '../database/prisma';
import { env } from '../config/env';

const TOKEN_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestEmailLogin(emailInput: string, sourceUserId: string): Promise<void> {
  if (!env.resendApiKey || !env.authEmailFrom) {
    throw new Error('Email authentication is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.');
  }

  const email = normalizeEmail(emailInput);
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
  const token = crypto.randomBytes(32).toString('base64url');

  await prisma.emailLoginToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.emailLoginToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, sourceUserId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const loginUrl = `${env.frontendUrl}/auth/verify?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.authEmailFrom,
      to: [email],
      subject: 'Sign in to Forex Analysis',
      text: `Open this link to sign in and access your analysis history:\n\n${loginUrl}\n\nThis link expires in 15 minutes.`,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json() as { message?: string; name?: string };
      detail = body.message || body.name || '';
    } catch {
      detail = '';
    }
    throw new Error(`Resend rejected the login email with status ${response.status}${detail ? `: ${detail}` : '.'}`);
  }
}

export async function verifyEmailLogin(token: string, anonymousUserId: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const loginToken = await tx.emailLoginToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!loginToken || loginToken.usedAt || loginToken.expiresAt <= new Date()) return null;

    const targetUserId = loginToken.userId;
    const sourceUserIds = new Set([anonymousUserId, loginToken.sourceUserId].filter((id): id is string => Boolean(id) && id !== targetUserId));
    if (sourceUserIds.size > 0) {
      const sourceAnalyses = await tx.analysis.findMany({ where: { userId: { in: [...sourceUserIds] } }, select: { id: true, snapshotKey: true } });
      const targetSnapshotKeys = new Set(
        (await tx.analysis.findMany({ where: { userId: targetUserId, snapshotKey: { not: null } }, select: { snapshotKey: true } }))
          .map((analysis) => analysis.snapshotKey)
      );

      for (const analysis of sourceAnalyses) {
        if (analysis.snapshotKey && targetSnapshotKeys.has(analysis.snapshotKey)) {
          await tx.analysis.delete({ where: { id: analysis.id } });
        } else {
          await tx.analysis.update({ where: { id: analysis.id }, data: { userId: targetUserId } });
        }
      }
      await tx.user.deleteMany({ where: { id: { in: [...sourceUserIds] }, email: null } });
    }

    await tx.emailLoginToken.update({ where: { id: loginToken.id }, data: { usedAt: new Date() } });
    return targetUserId;
  });
}