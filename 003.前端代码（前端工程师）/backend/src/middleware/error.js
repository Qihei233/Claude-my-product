import { ZodError } from 'zod';
import { ApiError } from '../utils/http.js';

export function notFound(req, res, next) {
  next(new ApiError(404, '接口不存在'));
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code ?? err.status,
      message: err.message,
      details: err.details ?? null,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      code: 400,
      message: err.issues[0]?.message || '请求参数不正确',
      details: err.flatten(),
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 400, message: '请求体不是合法的 JSON' });
  }

  if (err?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      code: 409,
      message: '该账号或昵称已被使用，请更换后重试',
    });
  }

  console.error('[server error]', err);
  return res.status(500).json({
    code: 500,
    message: '服务器开小差了，请稍后重试',
  });
}
