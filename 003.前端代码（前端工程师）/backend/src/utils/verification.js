import crypto from 'node:crypto';
import { config } from '../config/env.js';

export function createVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashVerificationCode(code) {
  return crypto
    .createHmac('sha256', config.verification.secret)
    .update(String(code))
    .digest('hex');
}

export function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}
