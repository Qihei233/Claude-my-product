import { query } from '../config/db.js';
import { hashToken } from '../utils/token.js';

/**
 * 可选登录：带有效 token 时挂载 req.user，不带或无效时按游客继续。
 * 用于课程、题目、排行榜等游客也能浏览的接口。
 */
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return next();

    const rows = await query(
      `SELECT u.id, u.nickname, u.avatar_url, u.role, u.status,
              p.level, p.exp, p.streak_days
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > NOW()
        LIMIT 1`,
      [hashToken(token)],
    );

    if (rows.length && rows[0].status === 'active') {
      req.user = rows[0];
      req.token = token;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
