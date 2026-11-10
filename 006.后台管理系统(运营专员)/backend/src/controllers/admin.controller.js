import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { signAdminToken } from '../utils/token.js';
import * as service from '../services/admin.service.js';

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    throw new ApiError(400, '请输入管理员账号和密码');
  }
  if (username !== config.admin.username) {
    throw new ApiError(401, '账号或密码不正确');
  }
  const valid = await bcrypt.compare(String(password), config.admin.passwordHash);
  if (!valid) throw new ApiError(401, '账号或密码不正确');

  const token = signAdminToken(
    username,
    config.admin.tokenSecret,
    config.admin.tokenHours,
  );
  return ok(res, {
    token,
    admin: { username, role: 'admin' },
    expiresIn: config.admin.tokenHours * 3600,
  });
});

export const overview = asyncHandler(async (req, res) => {
  return ok(res, await service.getOverview());
});

export const users = asyncHandler(async (req, res) => {
  return ok(res, await service.listUsers(req.query));
});

export const userDetail = asyncHandler(async (req, res) => {
  return ok(res, await service.getUserDetail(req.params.id));
});

export const courses = asyncHandler(async (req, res) => {
  return ok(res, await service.listCourses(req.query));
});

export const courseDetail = asyncHandler(async (req, res) => {
  return ok(res, await service.getCourseDetail(req.params.id));
});

export const questions = asyncHandler(async (req, res) => {
  return ok(res, await service.listQuestions(req.query));
});

export const questionDetail = asyncHandler(async (req, res) => {
  return ok(res, await service.getQuestionDetail(req.params.id));
});

export const records = asyncHandler(async (req, res) => {
  return ok(res, await service.listRecords(req.query));
});

export const submissions = asyncHandler(async (req, res) => {
  return ok(res, await service.listSubmissions(req.query));
});

export const progress = asyncHandler(async (req, res) => {
  return ok(res, await service.listProgress(req.query));
});

export const dailyStats = asyncHandler(async (req, res) => {
  return ok(res, await service.listDailyStats(req.query));
});

export const mastery = asyncHandler(async (req, res) => {
  return ok(res, await service.listMastery(req.query));
});

export const leaderboard = asyncHandler(async (req, res) => {
  return ok(res, await service.getLeaderboard());
});

export const messages = asyncHandler(async (req, res) => {
  return ok(res, await service.listMessages(req.query));
});

export const favorites = asyncHandler(async (req, res) => {
  return ok(res, await service.listFavorites(req.query));
});

export const recommendations = asyncHandler(async (req, res) => {
  return ok(res, await service.listRecommendations(req.query));
});

export const reports = asyncHandler(async (req, res) => {
  return ok(res, await service.listReports(req.query));
});

export const dailyQuestions = asyncHandler(async (req, res) => {
  return ok(res, await service.listDailyQuestions(req.query));
});

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const exportCsv = asyncHandler(async (req, res) => {
  const { headers, rows, filename } = await service.exportRows(
    req.params.type,
    req.query,
  );
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`﻿${csv}`);
});
