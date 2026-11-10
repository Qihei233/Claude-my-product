import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/adminAuth.js';
import * as controller from '../controllers/admin.controller.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '尝试次数过多，请稍后再试' },
});

router.post('/login', loginLimiter, controller.login);

router.use(requireAdmin);

router.get('/overview', controller.overview);
router.get('/users', controller.users);
router.get('/users/:id', controller.userDetail);
router.get('/courses', controller.courses);
router.get('/courses/:id', controller.courseDetail);
router.get('/questions', controller.questions);
router.get('/questions/:id', controller.questionDetail);
router.get('/records', controller.records);
router.get('/submissions', controller.submissions);
router.get('/progress', controller.progress);
router.get('/daily-stats', controller.dailyStats);
router.get('/mastery', controller.mastery);
router.get('/leaderboard', controller.leaderboard);
router.get('/messages', controller.messages);
router.get('/favorites', controller.favorites);
router.get('/recommendations', controller.recommendations);
router.get('/reports', controller.reports);
router.get('/daily-questions', controller.dailyQuestions);
router.get('/export/:type', controller.exportCsv);

export default router;
