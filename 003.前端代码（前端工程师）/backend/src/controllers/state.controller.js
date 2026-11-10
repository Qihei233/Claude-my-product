import * as stateService from '../services/state.service.js';
import {
  findQuestionByCode,
  judgeQuestion,
} from '../services/judge.service.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';

export const getState = asyncHandler(async (req, res) => {
  return ok(res, await stateService.getState(req.user.id));
});

export const startCourse = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.startCourse(req.user.id, req.params.courseId),
  );
});

export const completeLesson = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.completeLesson(
      req.user.id,
      req.params.lessonId,
      String(req.body?.code || ''),
    ),
  );
});

export const recordProblemAttempt = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const code = String(body.code || '');
  const { id } = await findQuestionByCode(req.params.problemId);
  const judged = await judgeQuestion(id, code);

  const result = await stateService.recordProblemAttempt(
    req.user.id,
    req.params.problemId,
    {
      passed: judged.accepted,
      usedHint: Boolean(body.usedHint),
      hintLevel: body.hintLevel,
      code,
      passedCases: judged.passedCases,
      totalCases: judged.totalCases,
      failedCase: judged.firstFailed
        ? JSON.stringify({
            input: judged.firstFailed.input,
            expected: judged.firstFailed.expected,
          }).slice(0, 255)
        : null,
      runtimeMs: judged.durationMs,
    },
  );

  return ok(res, {
    ...result,
    accepted: judged.accepted,
    passedCases: judged.passedCases,
    totalCases: judged.totalCases,
    output: judged.output,
    expected: judged.expected,
    error: judged.error,
    friendlyError: judged.friendlyError,
    results: judged.results,
  });
});

export const toggleFavorite = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.body || {};
  return ok(
    res,
    await stateService.toggleFavorite(req.user.id, targetType, targetId),
  );
});

export const markMessageRead = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.markMessageRead(req.user.id, req.params.messageId),
  );
});

export const markAllMessagesRead = asyncHandler(async (req, res) => {
  return ok(res, await stateService.markAllMessagesRead(req.user.id));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, '请选择头像图片');
  return ok(res, await stateService.updateAvatar(req.user.id, req.file));
});


export const checkDailyReminder = asyncHandler(async (req, res) => {
  return ok(res, await stateService.checkDailyReminder(req.user.id));
});

export const updateProfile = asyncHandler(async (req, res) => {
  return ok(res, await stateService.updateProfile(req.user.id, req.body || {}));
});

export const updatePreferences = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.updatePreferences(req.user.id, req.body || {}),
  );
});

export const completeOnboarding = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.completeOnboarding(req.user.id, req.body || {}),
  );
});

export const changePassword = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.changePassword(req.user.id, req.body || {}),
  );
});

export const changePhone = asyncHandler(async (req, res) => {
  return ok(res, await stateService.changePhone(req.user.id, req.body || {}));
});

export const listRecords = asyncHandler(async (req, res) => {
  return ok(
    res,
    await stateService.listRecords(req.user.id, {
      type: req.query.type,
      limit: req.query.limit,
    }),
  );
});

export const listMessages = asyncHandler(async (req, res) => {
  return ok(res, await stateService.listMessages(req.user.id));
});

export const listAchievements = asyncHandler(async (req, res) => {
  return ok(res, await stateService.listAchievements(req.user.id));
});
