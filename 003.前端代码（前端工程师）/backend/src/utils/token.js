import crypto from 'node:crypto';
import { config } from '../config/env.js';

export function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionExpiry(rememberMe) {
  const milliseconds = rememberMe
    ? config.session.rememberDays * 24 * 60 * 60 * 1000
    : config.session.shortHours * 60 * 60 * 1000;
  return new Date(Date.now() + milliseconds);
}
