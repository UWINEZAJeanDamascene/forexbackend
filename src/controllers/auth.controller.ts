import { Request, Response } from 'express';
import { requestEmailLogin, verifyEmailLogin } from '../services/emailAuthService';
import { setHistorySession } from '../middleware/historyAuth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestLogin(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  if (!EMAIL_PATTERN.test(email.trim())) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  try {
    await requestEmailLogin(email, req.historyUserId!);
    res.status(202).json({ message: 'If that email can receive messages, a sign-in link has been sent.' });
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Could not send sign-in email.' });
  }
}

export async function verifyLogin(req: Request, res: Response): Promise<void> {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) {
    res.status(400).json({ error: 'A sign-in token is required.' });
    return;
  }

  const userId = await verifyEmailLogin(token, req.historyUserId!);
  if (!userId) {
    res.status(401).json({ error: 'This sign-in link is invalid, expired, or already used.' });
    return;
  }

  setHistorySession(res, userId);
  res.status(200).json({ message: 'Signed in successfully.' });
}