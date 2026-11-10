import { ApiError } from '../utils/http.js';

export function notFound(req, res) {
  res.status(404).json({ code: 404, message: '接口不存在' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error instanceof ApiError ? error.status : 500;
  const message =
    error instanceof ApiError ? error.message : '服务器开小差了，请稍后再试';

  if (!(error instanceof ApiError)) {
    console.error(error);
  }

  return res.status(status).json({ code: status, message });
}
