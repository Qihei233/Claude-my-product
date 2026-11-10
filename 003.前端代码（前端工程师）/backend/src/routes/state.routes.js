import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { avatarUpload } from '../middleware/upload.js';
import * as controller from '../controllers/state.controller.js';

const router = Router();

const judgeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(requireAuth);

router.get('/state', controller.getState);
router.get('/records', controller.listRecords);
router.get('/messages', controller.listMessages);
router.get('/achievements', controller.listAchievements);

router.post('/courses/:courseId/start', controller.startCourse);
router.post('/lessons/:lessonId/complete', controller.completeLesson);
router.post(
  '/problems/:problemId/attempt',
  judgeLimiter,
  controller.recordProblemAttempt,
);
router.post('/favorites/toggle', controller.toggleFavorite);
router.post('/messages/read-all', controller.markAllMessagesRead);
router.post('/messages/:messageId/read', controller.markMessageRead);
router.post('/onboarding', controller.completeOnboarding);
router.post('/reminder-check', controller.checkDailyReminder);
router.post('/password', controller.changePassword);
router.post('/phone', controller.changePhone);

router.patch('/profile', controller.updateProfile);
router.post('/avatar', avatarUpload.single('avatar'), controller.uploadAvatar);
router.patch('/preferences', controller.updatePreferences);

export default router;
