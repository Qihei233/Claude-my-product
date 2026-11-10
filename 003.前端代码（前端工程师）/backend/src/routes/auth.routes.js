import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as controller from '../controllers/auth.controller.js';
import {
  loginCodeSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendCodeSchema,
} from '../validators/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
  },
});

router.post('/send-code', authLimiter, validate(sendCodeSchema), controller.sendCode);
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/login-code', authLimiter, validate(loginCodeSchema), controller.loginByCode);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  controller.resetPassword,
);
router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, controller.logout);

export default router;
