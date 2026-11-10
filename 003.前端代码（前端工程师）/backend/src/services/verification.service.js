import { config } from '../config/env.js';
import { execute, query } from '../config/db.js';
import { ApiError } from '../utils/http.js';
import {
  createVerificationCode,
  hashVerificationCode,
  safeEqual,
} from '../utils/verification.js';

const MAX_PER_MINUTE = 1;
const MAX_PER_DAY = 10;

function normalizeAccount(accountType, account) {
  return accountType === 'email'
    ? String(account).trim().toLowerCase()
    : String(account).trim();
}

function accountColumn(accountType) {
  if (accountType === 'phone') return 'phone';
  if (accountType === 'email') return 'email';
  throw new ApiError(400, '账号类型不正确');
}

async function findUserByAccount(accountType, account) {
  const column = accountColumn(accountType);
  const rows = await query(
    `SELECT id FROM users WHERE ${column} = ? LIMIT 1`,
    [account],
  );
  return rows[0] || null;
}

/**
 * 发送验证码。
 * 开发环境会在响应里返回 devCode；生产环境应接入短信/邮件服务。
 */
export async function sendVerificationCode({ accountType, account, purpose, ip }) {
  const normalizedAccount = normalizeAccount(accountType, account);
  const existingUser = await findUserByAccount(accountType, normalizedAccount);

  if (purpose === 'register' && existingUser) {
    throw new ApiError(
      409,
      accountType === 'phone' ? '该手机号已注册' : '该邮箱已注册',
    );
  }

  if ((purpose === 'login' || purpose === 'reset_password') && !existingUser) {
    throw new ApiError(404, '账号不存在');
  }

  const recent = await query(
    `SELECT COUNT(*) AS total
       FROM verification_codes
      WHERE account = ? AND purpose = ? AND created_at >= NOW() - INTERVAL 1 MINUTE`,
    [normalizedAccount, purpose],
  );

  if (Number(recent[0].total) >= MAX_PER_MINUTE) {
    throw new ApiError(429, '验证码发送太频繁，请 60 秒后再试');
  }

  const daily = await query(
    `SELECT COUNT(*) AS total
       FROM verification_codes
      WHERE account = ? AND purpose = ? AND created_at >= NOW() - INTERVAL 1 DAY`,
    [normalizedAccount, purpose],
  );

  if (Number(daily[0].total) >= MAX_PER_DAY) {
    throw new ApiError(429, '今日验证码发送次数已达上限，请明天再试');
  }

  const code = createVerificationCode();
  const expiresAt = new Date(
    Date.now() + config.verification.ttlMinutes * 60 * 1000,
  );

  await execute(
    `INSERT INTO verification_codes
       (account, account_type, purpose, code_hash, expires_at, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      normalizedAccount,
      accountType,
      purpose,
      hashVerificationCode(code),
      expiresAt,
      ip || null,
    ],
  );

  const payload = { expiresIn: config.verification.ttlMinutes * 60 };

  // 仅开发环境返回，方便本地联调；生产环境关闭。
  if (config.verification.devReturn) payload.devCode = code;

  return payload;
}

/** 校验并消费验证码 */
export async function verifyCode({ accountType, account, purpose, code }) {
  const normalizedAccount = normalizeAccount(accountType, account);

  const rows = await query(
    `SELECT id, code_hash
       FROM verification_codes
      WHERE account = ? AND account_type = ? AND purpose = ?
        AND used_at IS NULL AND expires_at > NOW()
      ORDER BY id DESC
      LIMIT 1`,
    [normalizedAccount, accountType, purpose],
  );

  if (!rows.length) {
    throw new ApiError(400, '验证码不正确或已过期');
  }

  const record = rows[0];
  if (!safeEqual(record.code_hash, hashVerificationCode(code))) {
    throw new ApiError(400, '验证码不正确或已过期');
  }

  const result = await execute(
    `UPDATE verification_codes SET used_at = NOW()
      WHERE id = ? AND used_at IS NULL`,
    [record.id],
  );

  if (result.affectedRows !== 1) {
    throw new ApiError(400, '验证码已被使用，请重新获取');
  }

  return true;
}
