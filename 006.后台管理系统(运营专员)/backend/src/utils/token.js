import crypto from 'node:crypto';

function signature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signAdminToken(username, secret, ttlHours = 2) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      role: 'admin',
      exp: Date.now() + ttlHours * 60 * 60 * 1000,
    }),
  ).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminToken(token, secret) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;

  const expected = signature(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
