import * as contentService from '../services/content.service.js';
import {
  findQuestionByCode,
  judgeLesson,
  runQuestion,
} from '../services/judge.service.js';
import { asyncHandler, ok } from '../utils/http.js';

export const listCourses = asyncHandler(async (req, res) => {
  return ok(res, await contentService.listCourses());
});

export const getCourse = asyncHandler(async (req, res) => {
  return ok(res, await contentService.getCourseByCode(req.params.courseId));
});

export const listProblems = asyncHandler(async (req, res) => {
  return ok(res, await contentService.listProblems());
});

export const getProblem = asyncHandler(async (req, res) => {
  return ok(res, await contentService.getProblemByCode(req.params.problemId));
});

export const getLesson = asyncHandler(async (req, res) => {
  return ok(
    res,
    await contentService.getLessonByCode(req.params.lessonId, req.user?.id),
  );
});

export const getRanking = asyncHandler(async (req, res) => {
  return ok(res, await contentService.getWeeklyLeaderboard(req.user?.id));
});

export const getDailyQuestion = asyncHandler(async (req, res) => {
  return ok(res, await contentService.getDailyQuestion());
});

export const listKnowledgePoints = asyncHandler(async (req, res) => {
  return ok(res, await contentService.listKnowledgePoints());
});

export const runProblem = asyncHandler(async (req, res) => {
  const { id } = await findQuestionByCode(req.params.problemId);
  const code = String(req.body?.code || '');
  return ok(res, await runQuestion(id, code));
});

export const runLesson = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || '');
  return ok(res, await judgeLesson(req.params.lessonId, code));
});
