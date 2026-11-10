import { asyncHandler, ok } from '../utils/http.js';
import * as authService from '../services/auth.service.js';
import * as verificationService from '../services/verification.service.js';

export const sendCode = asyncHandler(async (req, res) => {
  const data = await verificationService.sendVerificationCode({
    ...req.body,
    ip: req.ip,
  });
  return ok(res, data);
});

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  return ok(res, data);
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  return ok(res, data);
});

export const loginByCode = asyncHandler(async (req, res) => {
  const data = await authService.loginByCode(req.body, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  return ok(res, data);
});

export const resetPassword = asyncHandler(async (req, res) => {
  return ok(res, await authService.resetPassword(req.body));
});

export const me = asyncHandler(async (req, res) => {
  const data = await authService.getMe(req.user.id);
  return ok(res, data);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.token);
  return ok(res, null);
});
