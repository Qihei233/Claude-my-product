import { config } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { verifyAdminToken } from '../utils/token.js';

export function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new ApiError(401, '请先登录后台');

    const admin = verifyAdminToken(token, config.admin.tokenSecret);
    if (!admin) throw new ApiError(401, '登录已过期，请重新登录');

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}
