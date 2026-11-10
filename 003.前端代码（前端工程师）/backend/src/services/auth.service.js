import crypto from 'node:crypto';
import { execute, query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/http.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { createToken, hashToken, sessionExpiry } from '../utils/token.js';
import { phoneRegex } from '../validators/auth.js';
import { verifyCode } from './verification.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function accountColumn(accountType) {
  if (accountType === 'phone') return 'phone';
  if (accountType === 'email') return 'email';
  throw new ApiError(400, '账号类型不正确');
}

function normalizeAccount(accountType, account) {
  return accountType === 'email'
    ? String(account).trim().toLowerCase()
    : String(account).trim();
}

function detectAccountType(account) {
  const value = String(account).trim();
  if (phoneRegex.test(value)) return 'phone';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
  return null;
}

function maskPhone(phone) {
  return phone ? phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : null;
}

function maskEmail(email) {
  if (!email) return null;
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

export function toPublicUser(row) {
  return {
    userId: String(row.id),
    nickname: row.nickname,
    avatar: row.avatar_url,
    phone: maskPhone(row.phone),
    email: maskEmail(row.email),
    role: row.role,
    level: row.level ?? 1,
    exp: row.exp ?? 0,
    streakDays: row.streak_days ?? 0,
    dailyGoalMinutes: row.daily_goal_minutes ?? 30,
    onboardingCompleted: Boolean(row.onboarding_completed),
  };
}

async function loadUserWithProfile(userId) {
  const rows = await query(
    `SELECT
       u.id, u.nickname, u.avatar_url, u.phone, u.email, u.role, u.status,
       p.level, p.exp, p.streak_days, p.daily_goal_minutes, p.onboarding_completed
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function createSession(userId, rememberMe, meta = {}) {
  const token = createToken();
  const tokenHash = hashToken(token);
  const expiresAt = sessionExpiry(rememberMe);

  await execute(
    `INSERT INTO sessions
       (id, user_id, token_hash, remember_me, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId,
      tokenHash,
      rememberMe ? 1 : 0,
      meta.ip ? String(meta.ip).slice(0, 45) : null,
      meta.userAgent ? String(meta.userAgent).slice(0, 255) : null,
      expiresAt,
    ],
  );

  return { token, expiresAt };
}

async function generateNickname() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `奶蛙${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const rows = await query('SELECT id FROM users WHERE nickname = ? LIMIT 1', [
      candidate,
    ]);
    if (!rows.length) return candidate;
  }
  return `奶蛙${String(Date.now()).slice(-6)}`;
}

export async function register(payload, meta = {}) {
  const { accountType, code, password } = payload;
  const nickname = payload.nickname?.trim() || (await generateNickname());
  const account = normalizeAccount(accountType, payload.account);
  const column = accountColumn(accountType);

  const accountRows = await query(
    `SELECT id FROM users WHERE ${column} = ? LIMIT 1`,
    [account],
  );

  if (accountRows.length) {
    throw new ApiError(
      409,
      accountType === 'phone' ? '该手机号已注册' : '该邮箱已注册',
    );
  }

  const nicknameRows = await query(
    `SELECT id FROM users WHERE nickname = ? LIMIT 1`,
    [nickname],
  );

  if (nicknameRows.length) {
    throw new ApiError(409, '昵称已被使用，换一个试试');
  }

  await verifyCode({ accountType, account, purpose: 'register', code });

  const passwordHash = await hashPassword(password);

  const userId = await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO users (phone, email, password_hash, nickname)
       VALUES (?, ?, ?, ?)`,
      [
        accountType === 'phone' ? account : null,
        accountType === 'email' ? account : null,
        passwordHash,
        nickname,
      ],
    );

    await conn.execute(`INSERT INTO user_profiles (user_id) VALUES (?)`, [
      result.insertId,
    ]);

    return result.insertId;
  });

  const user = await loadUserWithProfile(userId);
  const session = await createSession(userId, false, meta);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toPublicUser(user),
  };
}

export async function login(payload, meta = {}) {
  const { password, rememberMe = false } = payload;
  const account = String(payload.account).trim();
  const accountType = detectAccountType(account);

  if (!accountType) {
    throw new ApiError(400, '请输入正确的手机号或邮箱');
  }

  const column = accountColumn(accountType);
  const normalizedAccount = normalizeAccount(accountType, account);
  const rows = await query(`SELECT * FROM users WHERE ${column} = ? LIMIT 1`, [
    normalizedAccount,
  ]);

  const user = rows[0];
  if (!user) throw new ApiError(401, '账号或密码不正确');

  if (user.status !== 'active') {
    throw new ApiError(403, '账号已被禁用，请联系管理员');
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000),
    );
    throw new ApiError(423, `尝试次数过多，请 ${minutes} 分钟后再试`);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const failedAttempts = Number(user.failed_login_attempts || 0) + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;

    await execute(
      `UPDATE users
          SET failed_login_attempts = ?, locked_until = ?
        WHERE id = ?`,
      [failedAttempts, lockedUntil, user.id],
    );

    const error = new ApiError(
      lockedUntil ? 423 : 401,
      lockedUntil
        ? `尝试次数过多，请 ${LOCK_MINUTES} 分钟后再试`
        : '账号或密码不正确',
    );
    error.details = {
      failedAttempts,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
      needCaptcha: failedAttempts >= 3,
    };
    throw error;
  }

  await execute(
    `UPDATE users
        SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
      WHERE id = ?`,
    [user.id],
  );

  const profile = await loadUserWithProfile(user.id);
  const session = await createSession(user.id, rememberMe, meta);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toPublicUser(profile),
  };
}

export async function loginByCode(payload, meta = {}) {
  const { accountType, code } = payload;
  const account = normalizeAccount(accountType, payload.account);

  await verifyCode({ accountType, account, purpose: 'login', code });

  const column = accountColumn(accountType);
  const rows = await query(`SELECT * FROM users WHERE ${column} = ? LIMIT 1`, [
    account,
  ]);

  if (!rows.length) throw new ApiError(404, '账号不存在');
  if (rows[0].status !== 'active') {
    throw new ApiError(403, '账号已被禁用，请联系管理员');
  }

  await execute(
    `UPDATE users
        SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW()
      WHERE id = ?`,
    [rows[0].id],
  );

  const profile = await loadUserWithProfile(rows[0].id);
  const session = await createSession(rows[0].id, false, meta);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toPublicUser(profile),
  };
}

export async function resetPassword(payload) {
  const { accountType, code, password } = payload;
  const account = normalizeAccount(accountType, payload.account);
  const column = accountColumn(accountType);

  const rows = await query(
    `SELECT id, status FROM users WHERE ${column} = ? LIMIT 1`,
    [account],
  );
  if (!rows.length) throw new ApiError(404, '账号不存在');
  if (rows[0].status !== 'active') {
    throw new ApiError(403, '账号已被禁用，请联系管理员');
  }

  await verifyCode({ accountType, account, purpose: 'reset_password', code });
  const passwordHash = await hashPassword(password);

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE users
          SET password_hash = ?, failed_login_attempts = 0,
              locked_until = NULL, updated_at = NOW()
        WHERE id = ?`,
      [passwordHash, rows[0].id],
    );
    await conn.execute('DELETE FROM sessions WHERE user_id = ?', [rows[0].id]);
  });

  return { ok: true };
}

export async function getMe(userId) {
  const user = await loadUserWithProfile(userId);
  if (!user) throw new ApiError(401, '请先登录');
  return { user: toPublicUser(user) };
}

export async function logout(token) {
  if (!token) return;
  await execute(`DELETE FROM sessions WHERE token_hash = ?`, [hashToken(token)]);
}
