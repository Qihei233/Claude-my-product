import { query } from '../config/db.js';
import { ApiError } from '../utils/http.js';
import { hashToken } from '../utils/token.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new ApiError(401, '请先登录');

    const rows = await query(
      `SELECT
         u.id, u.nickname, u.avatar_url, u.phone, u.email, u.role, u.status,
         p.level, p.exp, p.streak_days, p.daily_goal_minutes, p.onboarding_completed
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > NOW()
       LIMIT 1`,
      [hashToken(token)],
    );

    if (!rows.length) throw new ApiError(401, '登录已过期，请重新登录');
    if (rows[0].status !== 'active') throw new ApiError(403, '账号已被禁用');

    req.user = rows[0];
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}
