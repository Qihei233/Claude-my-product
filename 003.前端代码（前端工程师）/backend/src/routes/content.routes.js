import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth } from '../middleware/optionalAuth.js';
import * as controller from '../controllers/content.controller.js';

const router = Router();

const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/problems/:problemId/run', runLimiter, controller.runProblem);
router.post('/lessons/:lessonId/run', runLimiter, controller.runLesson);

router.get('/courses', controller.listCourses);
router.get('/courses/:courseId', controller.getCourse);
router.get('/problems', controller.listProblems);
router.get('/problems/:problemId', controller.getProblem);
router.get('/daily-question', controller.getDailyQuestion);
router.get('/lessons/:lessonId', optionalAuth, controller.getLesson);
router.get('/ranking', optionalAuth, controller.getRanking);
router.get('/knowledge-points', controller.listKnowledgePoints);

export default router;
