import { ApiError } from '../utils/http.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new ApiError(400, firstIssue?.message || '请求参数不正确', 400, result.error.flatten()),
      );
    }
    req.body = result.data;
    next();
  };
}
