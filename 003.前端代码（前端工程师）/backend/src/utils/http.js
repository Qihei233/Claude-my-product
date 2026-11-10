export class ApiError extends Error {
  constructor(status, message, code = status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok(res, data = null) {
  return res.json({ code: 0, message: 'success', data });
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
