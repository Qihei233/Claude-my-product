import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/http.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { phoneRegex } from '../validators/auth.js';
import { verifyCode } from './verification.service.js';
import { judgeQuestion } from './judge.service.js';

const UPLOAD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../uploads',
);

const AVATAR_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function maskPhone(phone) {
  return phone ? phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : null;
}

function maskEmail(email) {
  if (!email) return null;
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

const GOAL_LABELS = {
  office: '办公自动化',
  data: '数据分析',
  interest: '兴趣入门',
  course: '应付课业',
};

const INTEREST_GOALS = {
  办公自动化: 'office',
  Excel: 'office',
  数据分析: 'data',
  兴趣入门: 'interest',
  应付课业: 'course',
};

const ACHIEVEMENT_ICONS = {
  first_line: 'terminal',
  ten_lessons: 'sprout',
  chapter_clear: 'flag',
  practice_50: 'target',
  first_try: 'star',
  streak_7: 'flame',
  streak_30: 'calendar',
  first_course: 'graduation',
  frog_doctor: 'trophy',
};

function levelFromExp(exp) {
  if (exp <= 100) return 1;
  if (exp <= 300) return 2;
  if (exp <= 700) return 3;
  if (exp <= 1500) return 4;
  return 5;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dotDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function clockTime(value) {
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function messageTime(value) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `今天 ${clockTime(date)}`;
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${clockTime(date)}`;
}

function recordGroup(value) {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfRecord = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfRecord) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'earlier';
}

function mapGoals(interests) {
  const goals = [];
  for (const item of interests) {
    const goal = INTEREST_GOALS[item.interest];
    if (goal && !goals.includes(goal)) goals.push(goal);
  }
  return goals.slice(0, 2);
}

function mapPreferences(profile) {
  const fontSize = Number(profile.code_font_size) || 14;
  return {
    lessonFontSize: [12, 14, 16].includes(fontSize) ? fontSize : 14,
    reminderEnabled: Boolean(profile.study_reminder_enabled),
    reminderTime: profile.reminder_time
      ? String(profile.reminder_time).slice(0, 5)
      : '20:00',
    achievementNotify: Boolean(profile.achievement_notification_enabled),
    defaultHome:
      profile.default_home === 'profile' ? 'practice' : profile.default_home || 'home',
  };
}

async function unlockAchievement(conn, userId, code) {
  const [result] = await conn.execute(
    `INSERT IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
     SELECT ?, id, NOW() FROM achievements WHERE code = ?`,
    [userId, code],
  );
  if (!result.affectedRows) return;

  const [rows] = await conn.execute(
    `SELECT a.id, a.name, a.description, u.achievement_notification_enabled
       FROM achievements a
       JOIN user_profiles u ON u.user_id = ?
      WHERE a.code = ?
      LIMIT 1`,
    [userId, code],
  );
  const achievement = rows[0];
  if (achievement?.achievement_notification_enabled) {
    await conn.execute(
      `INSERT INTO messages
         (user_id, title, content, message_type, action_type, action_id)
       VALUES (?, ?, ?, 'achievement', 'achievement', ?)`,
      [
        userId,
        `解锁成就：${achievement.name}`,
        achievement.description || achievement.name,
        achievement.id,
      ],
    );
  }
}

async function refreshLevel(conn, userId, gainedExp) {
  const [rows] = await conn.execute(
    'SELECT exp FROM user_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  if (!rows.length) return 1;
  const exp = Number(rows[0].exp) + gainedExp;
  const level = levelFromExp(exp);
  await conn.execute(
    'UPDATE user_profiles SET exp = ?, level = ?, updated_at = NOW() WHERE user_id = ?',
    [exp, level, userId],
  );
  if (level >= 5) await unlockAchievement(conn, userId, 'frog_doctor');
  return level;
}

async function addDailyStats(conn, userId, fields) {
  const {
    studyMinutes = 0,
    lessonsCompleted = 0,
    questionsAttempted = 0,
    questionsPassed = 0,
    expEarned = 0,
    streakDays = 0,
  } = fields;

  await conn.execute(
    `INSERT INTO user_daily_stats
       (user_id, stat_date, study_minutes, lessons_completed, questions_attempted,
        questions_passed, exp_earned, streak_days)
     VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       study_minutes = study_minutes + VALUES(study_minutes),
       lessons_completed = lessons_completed + VALUES(lessons_completed),
       questions_attempted = questions_attempted + VALUES(questions_attempted),
       questions_passed = questions_passed + VALUES(questions_passed),
       exp_earned = exp_earned + VALUES(exp_earned),
       streak_days = GREATEST(streak_days, VALUES(streak_days)),
       updated_at = NOW()`,
    [
      userId,
      studyMinutes,
      lessonsCompleted,
      questionsAttempted,
      questionsPassed,
      expEarned,
      streakDays,
    ],
  );
}

async function getLessonsOfCourse(courseId) {
  return query(
    `SELECT l.id, l.lesson_code, l.title, l.duration_minutes,
            ch.id AS chapter_id, ch.title AS chapter_title
       FROM lessons l
       JOIN chapters ch ON ch.id = l.chapter_id
      WHERE ch.course_id = ? AND l.status = 'published'
      ORDER BY ch.sort_order, l.sort_order`,
    [courseId],
  );
}

async function findCourse(courseCode) {
  const rows = await query(
    'SELECT id, course_code, title FROM courses WHERE course_code = ? LIMIT 1',
    [courseCode],
  );
  if (!rows.length) throw new ApiError(404, '课程不存在');
  return rows[0];
}

export async function getState(userId) {
  const userRows = await query(
    `SELECT u.id, u.nickname, u.avatar_url, u.phone, u.email, u.role, u.status,
            u.last_login_at, u.created_at,
            p.python_base, p.level, p.exp, p.streak_days, p.longest_streak_days,
            p.total_study_minutes, p.daily_goal_minutes, p.bio,
            p.onboarding_completed, p.study_reminder_enabled, p.reminder_time,
            p.achievement_notification_enabled, p.code_font_size, p.default_home
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = ?
      LIMIT 1`,
    [userId],
  );
  if (!userRows.length) throw new ApiError(404, '用户不存在');
  const profile = userRows[0];

  const [
    progressRows,
    problemRows,
    favoriteRows,
    achievementRows,
    interestRows,
    messageRows,
    statsRows,
    countRows,
    enrollmentRows,
  ] = await Promise.all([
    query(
      `SELECT c.course_code, l.lesson_code, lp.status, lp.progress_percent
         FROM user_lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN chapters ch ON ch.id = l.chapter_id
         JOIN courses c ON c.id = ch.course_id
        WHERE lp.user_id = ?
        ORDER BY c.sort_order, ch.sort_order, l.sort_order`,
      [userId],
    ),
    query(
      `SELECT question_code, attempt_count, accepted_count, status, stars
         FROM v_user_question_status
        WHERE user_id = ? AND attempt_count > 0`,
      [userId],
    ),
    query(
      `SELECT f.target_type, f.created_at,
              c.course_code, q.question_code, l.lesson_code
         FROM favorites f
         LEFT JOIN courses c ON f.target_type = 'course' AND c.id = f.target_id
         LEFT JOIN questions q ON f.target_type = 'question' AND q.id = f.target_id
         LEFT JOIN lessons l ON f.target_type = 'lesson' AND l.id = f.target_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC`,
      [userId],
    ),
    query(
      `SELECT a.code, ua.unlocked_at
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = ?`,
      [userId],
    ),
    query('SELECT interest, weight FROM user_interests WHERE user_id = ?', [
      userId,
    ]),
    query(
      'SELECT id, is_read FROM messages WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    ),
    query(
      'SELECT stat_date FROM user_daily_stats WHERE user_id = ? AND stat_date = CURDATE() LIMIT 1',
      [userId],
    ),
    query(
      `SELECT
         (SELECT COUNT(*) FROM user_lesson_progress WHERE user_id = ? AND status = 'completed') AS completed_lessons,
         (SELECT COUNT(DISTINCT question_id) FROM submissions WHERE user_id = ? AND result = 'accepted') AS passed_questions,
         (SELECT COUNT(*) FROM course_enrollments WHERE user_id = ? AND status = 'completed') AS completed_courses`,
      [userId, userId, userId],
    ),
    query(
      `SELECT c.course_code, e.status, e.progress_percent
         FROM course_enrollments e
         JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = ?`,
      [userId],
    ),
  ]);

  const courseProgress = {};
  const completedCourses = enrollmentRows
    .filter((row) => row.status === 'completed')
    .map((row) => row.course_code);

  for (const row of progressRows) {
    if (!courseProgress[row.course_code]) {
      courseProgress[row.course_code] = {
        completedLessons: [],
        currentLessonId: undefined,
      };
    }
    const item = courseProgress[row.course_code];
    if (row.status === 'completed') item.completedLessons.push(row.lesson_code);
    if (row.status === 'in_progress' || row.status === 'unlocked') {
      item.currentLessonId = row.lesson_code;
    }
  }
  for (const row of enrollmentRows) {
    if (!courseProgress[row.course_code]) {
      courseProgress[row.course_code] = {
        completedLessons: [],
        currentLessonId: undefined,
      };
    }
    if (row.status === 'completed' && !completedCourses.includes(row.course_code)) {
      completedCourses.push(row.course_code);
    }
  }

  // 计算每门课“下一节未完成课时”，前端据此判断解锁状态。
  const courseCodes = Object.keys(courseProgress);
  if (courseCodes.length) {
    const placeholders = courseCodes.map(() => '?').join(',');
    const outlineRows = await query(
      `SELECT c.course_code, l.lesson_code
         FROM lessons l
         JOIN chapters ch ON ch.id = l.chapter_id
         JOIN courses c ON c.id = ch.course_id
        WHERE c.course_code IN (${placeholders}) AND l.status = 'published'
        ORDER BY c.sort_order, ch.sort_order, l.sort_order`,
      courseCodes,
    );
    const outlines = new Map();
    for (const row of outlineRows) {
      if (!outlines.has(row.course_code)) outlines.set(row.course_code, []);
      outlines.get(row.course_code).push(row.lesson_code);
    }
    for (const code of courseCodes) {
      const item = courseProgress[code];
      const completedSet = new Set(item.completedLessons);
      const outline = outlines.get(code) || [];
      const nextLesson = outline.find((lessonCode) => !completedSet.has(lessonCode));
      if (nextLesson) item.currentLessonId = nextLesson;
      else if (outline.length) item.currentLessonId = outline[outline.length - 1];
    }
  }

  const problemResults = {};
  for (const row of problemRows) {
    problemResults[row.question_code] = {
      stars: Number(row.stars) || 0,
      attempts: Number(row.attempt_count) || 0,
    };
  }

  const favoriteCourses = [];
  const favoriteProblems = [];
  const favoriteLessons = [];
  for (const row of favoriteRows) {
    if (row.course_code) favoriteCourses.push(row.course_code);
    if (row.question_code) favoriteProblems.push(row.question_code);
    if (row.lesson_code) favoriteLessons.push(row.lesson_code);
  }

  const achievements = {};
  for (const row of achievementRows) {
    achievements[row.code] = dotDate(row.unlocked_at);
  }

  const counts = countRows[0] || {};
  const unreadMessages = messageRows.filter((row) => !row.is_read).length;
  const created = profile.created_at ? new Date(profile.created_at) : new Date();
  const joinedDays = Math.max(
    1,
    Math.floor((Date.now() - created.getTime()) / 86400000) + 1,
  );

  return {
    id: String(profile.id),
    nickname: profile.nickname,
    initials: String(profile.nickname || '蛙').trim().slice(0, 1) || '蛙',
    avatar: profile.avatar_url || null,
    phone: maskPhone(profile.phone),
    email: maskEmail(profile.email),
    bio: profile.bio || '',
    joinedDays,
    exp: Number(profile.exp) || 0,
    streakDays: Number(profile.streak_days) || 0,
    hoursLearned: Number(
      ((Number(profile.total_study_minutes) || 0) / 60).toFixed(1),
    ),
    completedLessonCount: Number(counts.completed_lessons) || 0,
    passedProblemCount: Number(counts.passed_questions) || 0,
    goals: mapGoals(interestRows),
    courseProgress,
    completedCourses,
    problemResults,
    favoriteCourses,
    favoriteProblems,
    favoriteLessons,
    achievements,
    readMessageIds: messageRows
      .filter((row) => Boolean(row.is_read))
      .map((row) => String(row.id)),
    unreadMessageCount: unreadMessages,
    checkedInToday: statsRows.length > 0,
    preferences: mapPreferences(profile),
    onboardingCompleted: Boolean(profile.onboarding_completed),
    dailyGoalMinutes: Number(profile.daily_goal_minutes) || 30,
    pythonBase: profile.python_base || 'zero',
    level: Number(profile.level) || levelFromExp(Number(profile.exp) || 0),
  };
}

export async function startCourse(userId, courseCode) {
  const course = await findCourse(courseCode);
  const lessons = await getLessonsOfCourse(course.id);
  if (!lessons.length) throw new ApiError(404, '课程暂无课时');

  const existing = await query(
    'SELECT id, progress_percent FROM course_enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
    [userId, course.id],
  );

  const firstLesson = lessons[0];
  if (!existing.length) {
    await query(
      `INSERT INTO course_enrollments
         (user_id, course_id, status, progress_percent, last_lesson_id)
       VALUES (?, ?, 'learning', 0, ?)`,
      [userId, course.id, firstLesson.id],
    );
  }

  const progressRows = await query(
    `SELECT l.lesson_code
       FROM user_lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = ? AND lp.status = 'in_progress'
      ORDER BY lp.updated_at DESC
      LIMIT 1`,
    [userId],
  );

  return {
    courseId: course.course_code,
    firstLessonId: firstLesson.lesson_code,
    currentLessonId: progressRows[0]?.lesson_code || firstLesson.lesson_code,
    progressPercent: Number(existing[0]?.progress_percent) || 0,
  };
}

export async function completeLesson(userId, lessonCode, code = '') {
  const lessonRows = await query(
    `SELECT l.id, l.lesson_code, l.title, l.duration_minutes, l.question_id,
            ch.id AS chapter_id, ch.course_id, c.course_code
       FROM lessons l
       JOIN chapters ch ON ch.id = l.chapter_id
       JOIN courses c ON c.id = ch.course_id
      WHERE l.lesson_code = ? AND l.status = 'published'
      LIMIT 1`,
    [lessonCode],
  );
  if (!lessonRows.length) throw new ApiError(404, '课时不存在');
  const lesson = lessonRows[0];

  const lessons = await getLessonsOfCourse(lesson.course_id);
  const index = lessons.findIndex((item) => item.lesson_code === lessonCode);
  const nextLesson = index >= 0 ? lessons[index + 1] : undefined;

  const existingRows = await query(
    'SELECT status FROM user_lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1',
    [userId, lesson.id],
  );
  const alreadyCompleted = existingRows[0]?.status === 'completed';

  if (!alreadyCompleted && lesson.question_id) {
    const judged = await judgeQuestion(lesson.question_id, code);
    if (!judged.accepted) {
      throw new ApiError(422, '代码还没有通过全部测试用例', 422, {
        passedCases: judged.passedCases,
        totalCases: judged.totalCases,
        output: judged.output,
        expected: judged.expected,
        error: judged.error,
        friendlyError: judged.friendlyError,
        results: judged.results,
      });
    }
  }

  if (alreadyCompleted) {
    const completedRows = await query(
      `SELECT COUNT(*) AS total
         FROM user_lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN chapters ch ON ch.id = l.chapter_id
        WHERE lp.user_id = ? AND ch.course_id = ? AND lp.status = 'completed' AND l.status = 'published'`,
      [userId, lesson.course_id],
    );
    return {
      alreadyCompleted: true,
      expGained: 0,
      nextLessonId: nextLesson?.lesson_code,
      courseCompleted: Number(completedRows[0].total) >= lessons.length,
    };
  }

  const minutes = Number(lesson.duration_minutes) || 10;

  const result = await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO user_lesson_progress
         (user_id, lesson_id, status, progress_percent, completed_at, updated_at)
       VALUES (?, ?, 'completed', 100, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = 'completed', progress_percent = 100, completed_at = NOW(), updated_at = NOW()`,
      [userId, lesson.id],
    );

    await conn.execute(
      `INSERT INTO learning_records
         (user_id, record_type, lesson_id, target_name, result, duration_seconds, study_date)
       VALUES (?, 'lesson', ?, ?, 'completed', ?, CURDATE())`,
      [userId, lesson.id, lesson.title, minutes * 60],
    );

    const [streakRows] = await conn.execute(
      'SELECT streak_days FROM user_profiles WHERE user_id = ? LIMIT 1',
      [userId],
    );
    const streakDays = Number(streakRows[0]?.streak_days) || 0;
    await addDailyStats(conn, userId, {
      studyMinutes: minutes,
      lessonsCompleted: 1,
      expEarned: 20,
      streakDays,
    });

    const level = await refreshLevel(conn, userId, 20);
    await conn.execute(
      'UPDATE user_profiles SET total_study_minutes = total_study_minutes + ? WHERE user_id = ?',
      [minutes, userId],
    );

    const [completedRows] = await conn.execute(
      `SELECT COUNT(*) AS total
         FROM user_lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN chapters ch ON ch.id = l.chapter_id
        WHERE lp.user_id = ? AND ch.course_id = ? AND lp.status = 'completed' AND l.status = 'published'`,
      [userId, lesson.course_id],
    );
    const completedCount = Number(completedRows[0].total);
    const courseCompleted = completedCount >= lessons.length;
    const percent = lessons.length
      ? Number(((completedCount / lessons.length) * 100).toFixed(2))
      : 0;

    await conn.execute(
      `INSERT INTO course_enrollments
         (user_id, course_id, status, progress_percent, last_lesson_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         progress_percent = VALUES(progress_percent),
         last_lesson_id = VALUES(last_lesson_id),
         completed_at = IF(VALUES(status) = 'completed', NOW(), completed_at),
         updated_at = NOW()`,
      [
        userId,
        lesson.course_id,
        courseCompleted ? 'completed' : 'learning',
        percent,
        lesson.id,
      ],
    );

    const [chapterTotalRows] = await conn.execute(
      `SELECT COUNT(*) AS total, SUM(lp.status = 'completed') AS done
         FROM lessons l
         LEFT JOIN user_lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
        WHERE l.chapter_id = ? AND l.status = 'published'`,
      [userId, lesson.chapter_id],
    );
    const chapterDone =
      Number(chapterTotalRows[0].total) > 0 &&
      Number(chapterTotalRows[0].done) >= Number(chapterTotalRows[0].total);

    if (completedCount >= 1) await unlockAchievement(conn, userId, 'first_line');
    if (completedCount >= 10) await unlockAchievement(conn, userId, 'ten_lessons');
    if (chapterDone) await unlockAchievement(conn, userId, 'chapter_clear');
    if (courseCompleted) await unlockAchievement(conn, userId, 'first_course');
    if (level >= 5) await unlockAchievement(conn, userId, 'frog_doctor');

    return {
      alreadyCompleted: false,
      expGained: 20,
      nextLessonId: nextLesson?.lesson_code,
      courseCompleted,
    };
  });

  return result;
}

export async function recordProblemAttempt(userId, problemCode, payload) {
  const rows = await query(
    'SELECT id, question_code, title, difficulty FROM questions WHERE question_code = ? AND status = \'published\' LIMIT 1',
    [problemCode],
  );
  if (!rows.length) throw new ApiError(404, '题目不存在');
  const question = rows[0];

  const passed = Boolean(payload.passed);
  const usedHint = Boolean(payload.usedHint);
  const hintLevel = usedHint ? 1 : Math.max(0, Number(payload.hintLevel) || 0);

  const result = await withTransaction(async (conn) => {
    const [attemptRows] = await conn.execute(
      'SELECT COUNT(*) AS total FROM submissions WHERE user_id = ? AND question_id = ?',
      [userId, question.id],
    );
    const attemptNo = Number(attemptRows[0].total) + 1;

    const [acceptedRows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM submissions
        WHERE user_id = ? AND question_id = ? AND result = 'accepted'`,
      [userId, question.id],
    );
    const firstPass = passed && Number(acceptedRows[0].total) === 0;

    const stars = !passed
      ? 0
      : attemptNo === 1 && hintLevel === 0
        ? 3
        : hintLevel === 0
          ? 2
          : 1;

    await conn.execute(
      `INSERT INTO submissions
         (user_id, question_id, code, result, passed_cases, total_cases,
          failed_case, runtime_ms, hint_level_used, attempt_no, is_first_attempt_pass)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        question.id,
        String(payload.code || '').slice(0, 20000),
        passed ? 'accepted' : 'failed',
        Number(payload.passedCases ?? (passed ? 1 : 0)),
        Number(payload.totalCases ?? 1),
        payload.failedCase ? String(payload.failedCase).slice(0, 255) : null,
        Number(payload.runtimeMs ?? 0),
        hintLevel,
        attemptNo,
        passed && attemptNo === 1 ? 1 : 0,
      ],
    );

    await conn.execute(
      `INSERT INTO learning_records
         (user_id, record_type, question_id, target_name, result, duration_seconds, study_date)
       VALUES (?, 'question', ?, ?, ?, 0, CURDATE())`,
      [
        userId,
        question.id,
        `${question.question_code} ${question.title}`,
        passed ? 'passed' : 'failed',
      ],
    );

    const [streakRows] = await conn.execute(
      'SELECT streak_days FROM user_profiles WHERE user_id = ? LIMIT 1',
      [userId],
    );
    const streakDays = Number(streakRows[0]?.streak_days) || 0;
    await addDailyStats(conn, userId, {
      questionsAttempted: 1,
      questionsPassed: passed ? 1 : 0,
      expEarned: firstPass ? 30 : 0,
      streakDays,
    });

    if (firstPass) {
      const level = await refreshLevel(conn, userId, 30);
      if (level >= 5) await unlockAchievement(conn, userId, 'frog_doctor');
    }

    if (stars === 3) await unlockAchievement(conn, userId, 'first_try');

    const [passedRows] = await conn.execute(
      'SELECT COUNT(DISTINCT question_id) AS total FROM submissions WHERE user_id = ? AND result = \'accepted\'',
      [userId],
    );
    if (Number(passedRows[0].total) >= 50) {
      await unlockAchievement(conn, userId, 'practice_50');
    }

    const [kpRows] = await conn.execute(
      `SELECT qkp.knowledge_point_id, ms.score
         FROM question_knowledge_points qkp
         LEFT JOIN mastery_scores ms
           ON ms.knowledge_point_id = qkp.knowledge_point_id AND ms.user_id = ?
        WHERE qkp.question_id = ?`,
      [userId, question.id],
    );
    for (const kp of kpRows) {
      const oldScore = Number(kp.score) || 0;
      const nextScore = Math.min(
        1,
        Math.max(0, oldScore * 0.8 + (passed ? 0.2 : 0)),
      );
      await conn.execute(
        `INSERT INTO mastery_scores
           (user_id, knowledge_point_id, score, attempts, correct_count, last_practiced_at, updated_at)
         VALUES (?, ?, ?, 1, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           score = VALUES(score),
           attempts = attempts + 1,
           correct_count = correct_count + VALUES(correct_count),
           last_practiced_at = NOW(),
           updated_at = NOW()`,
        [userId, kp.knowledge_point_id, nextScore, passed ? 1 : 0],
      );
    }

    return {
      firstPass,
      stars,
      expGained: firstPass ? 30 : 0,
      attempts: attemptNo,
    };
  });

  return result;
}

export async function toggleFavorite(userId, targetType, targetCode) {
  if (!['course', 'question', 'lesson'].includes(targetType)) {
    throw new ApiError(400, '收藏类型不正确');
  }

  const table =
    targetType === 'course'
      ? { name: 'courses', code: 'course_code' }
      : targetType === 'question'
        ? { name: 'questions', code: 'question_code' }
        : { name: 'lessons', code: 'lesson_code' };

  const rows = await query(
    `SELECT id FROM ${table.name} WHERE ${table.code} = ? LIMIT 1`,
    [targetCode],
  );
  if (!rows.length) throw new ApiError(404, '收藏目标不存在');
  const targetId = rows[0].id;

  const existing = await query(
    'SELECT id FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ? LIMIT 1',
    [userId, targetType, targetId],
  );

  if (existing.length) {
    await query('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
    return { added: false, targetType, targetId: targetCode };
  }

  await query(
    'INSERT INTO favorites (user_id, target_type, target_id) VALUES (?, ?, ?)',
    [userId, targetType, targetId],
  );
  return { added: true, targetType, targetId: targetCode };
}

export async function markMessageRead(userId, messageId) {
  if (!/^\d+$/.test(String(messageId))) throw new ApiError(400, '消息 ID 不正确');
  await query(
    `UPDATE messages
        SET is_read = 1, read_at = COALESCE(read_at, NOW())
      WHERE id = ? AND user_id = ?`,
    [messageId, userId],
  );
  return { messageId: String(messageId) };
}

export async function markAllMessagesRead(userId) {
  await query(
    `UPDATE messages
        SET is_read = 1, read_at = COALESCE(read_at, NOW())
      WHERE user_id = ? AND is_read = 0`,
    [userId],
  );
  return { allRead: true };
}

export async function updateAvatar(userId, file) {
  if (!file?.buffer) throw new ApiError(400, '请选择头像图片');
  const ext = AVATAR_TYPES[file.mimetype];
  if (!ext) throw new ApiError(400, '头像仅支持 PNG / JPEG / WebP / GIF 格式');

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `avatar-${userId}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);

  const oldRows = await query('SELECT avatar_url FROM users WHERE id = ? LIMIT 1', [
    userId,
  ]);
  const url = `/uploads/${filename}`;
  await query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [
    url,
    userId,
  ]);

  const oldUrl = oldRows[0]?.avatar_url;
  if (oldUrl && oldUrl.startsWith('/uploads/')) {
    await fs
      .unlink(path.join(UPLOAD_DIR, path.basename(oldUrl)))
      .catch(() => {});
  }

  return getState(userId);
}

export async function updateProfile(userId, payload) {
  const nickname = String(payload.nickname || '').trim();
  if (!nickname) throw new ApiError(400, '昵称不能为空');
  if (nickname.length > 16) throw new ApiError(400, '昵称不能超过 16 个字符');

  const existing = await query(
    'SELECT id FROM users WHERE nickname = ? AND id <> ? LIMIT 1',
    [nickname, userId],
  );
  if (existing.length) throw new ApiError(409, '昵称已被使用，换一个试试');

  const goals = Array.isArray(payload.goals)
    ? payload.goals.filter((goal) => GOAL_LABELS[goal]).slice(0, 2)
    : null;

  await withTransaction(async (conn) => {
    await conn.execute('UPDATE users SET nickname = ?, updated_at = NOW() WHERE id = ?', [
      nickname,
      userId,
    ]);
    await conn.execute(
      'UPDATE user_profiles SET bio = ?, updated_at = NOW() WHERE user_id = ?',
      [String(payload.bio || '').slice(0, 50), userId],
    );

    if (goals) {
      await conn.execute('DELETE FROM user_interests WHERE user_id = ?', [userId]);
      for (const goal of goals) {
        await conn.execute(
          'INSERT INTO user_interests (user_id, interest, weight) VALUES (?, ?, 1.000)',
          [userId, GOAL_LABELS[goal]],
        );
      }
    }
  });

  return getState(userId);
}

export async function updatePreferences(userId, patch) {
  const fontSize = [12, 14, 16].includes(Number(patch.lessonFontSize))
    ? Number(patch.lessonFontSize)
    : null;
  const reminderEnabled =
    typeof patch.reminderEnabled === 'boolean'
      ? patch.reminderEnabled
        ? 1
        : 0
      : null;
  const achievementNotify =
    typeof patch.achievementNotify === 'boolean'
      ? patch.achievementNotify
        ? 1
        : 0
      : null;
  const reminderTime =
    typeof patch.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(patch.reminderTime)
      ? `${patch.reminderTime}:00`
      : null;
  const defaultHome = ['home', 'courses', 'practice'].includes(patch.defaultHome)
    ? patch.defaultHome === 'practice'
      ? 'profile'
      : patch.defaultHome
    : null;

  await query(
    `UPDATE user_profiles
        SET study_reminder_enabled = COALESCE(?, study_reminder_enabled),
            reminder_time = COALESCE(?, reminder_time),
            achievement_notification_enabled = COALESCE(?, achievement_notification_enabled),
            code_font_size = COALESCE(?, code_font_size),
            default_home = COALESCE(?, default_home),
            updated_at = NOW()
      WHERE user_id = ?`,
    [reminderEnabled, reminderTime, achievementNotify, fontSize, defaultHome, userId],
  );

  return getState(userId);
}

export async function completeOnboarding(userId, payload) {
  const pythonBase = ['zero', 'basic'].includes(payload.pythonBase)
    ? payload.pythonBase
    : 'zero';
  const goals = Array.isArray(payload.goals)
    ? payload.goals.filter((goal) => GOAL_LABELS[goal]).slice(0, 2)
    : [];
  const dailyGoalMinutes = Math.min(
    120,
    Math.max(10, Number(payload.dailyGoalMinutes) || 30),
  );

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE user_profiles
          SET python_base = ?, onboarding_completed = 1,
              daily_goal_minutes = ?, updated_at = NOW()
        WHERE user_id = ?`,
      [pythonBase, dailyGoalMinutes, userId],
    );
    await conn.execute('DELETE FROM user_interests WHERE user_id = ?', [userId]);
    for (const goal of goals) {
      await conn.execute(
        'INSERT INTO user_interests (user_id, interest, weight) VALUES (?, ?, 1.000)',
        [userId, GOAL_LABELS[goal]],
      );
    }
  });

  return getState(userId);
}

export async function checkDailyReminder(userId) {
  const rows = await query(
    `SELECT study_reminder_enabled, reminder_time
       FROM user_profiles
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );
  if (!rows.length || !rows[0].study_reminder_enabled) {
    return { created: false };
  }

  const now = new Date();
  const [hour, minute] = String(rows[0].reminder_time || '20:00:00')
    .split(':')
    .map(Number);
  if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) {
    return { created: false };
  }

  const studied = await query(
    'SELECT 1 FROM user_daily_stats WHERE user_id = ? AND stat_date = CURDATE() LIMIT 1',
    [userId],
  );
  if (studied.length) return { created: false };

  const existing = await query(
    `SELECT 1 FROM messages
      WHERE user_id = ? AND message_type = 'reminder'
        AND DATE(created_at) = CURDATE()
      LIMIT 1`,
    [userId],
  );
  if (existing.length) return { created: false };

  await query(
    `INSERT INTO messages
       (user_id, title, content, message_type, action_type)
     VALUES (?, ?, ?, 'reminder', 'page')`,
    [
      userId,
      '今天也该学习啦',
      '给自己留几分钟，写一行代码，让今天也留下一点学习的痕迹。',
    ],
  );

  return { created: true };
}

export async function changePhone(userId, payload) {
  const phone = String(payload.phone || '').trim();
  const code = String(payload.code || '').trim();
  if (!phoneRegex.test(phone)) throw new ApiError(400, '请输入正确的手机号');
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, '请输入 6 位验证码');

  const existing = await query(
    'SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1',
    [phone, userId],
  );
  if (existing.length) throw new ApiError(409, '该手机号已被其他账号绑定');

  await verifyCode({
    accountType: 'phone',
    account: phone,
    purpose: 'register',
    code,
  });

  await query('UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?', [
    phone,
    userId,
  ]);

  return getState(userId);
}

export async function changePassword(userId, payload) {
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');
  if (newPassword.length < 8 || newPassword.length > 20) {
    throw new ApiError(400, '新密码需为 8-20 位');
  }
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw new ApiError(400, '新密码需同时包含字母和数字');
  }

  const rows = await query(
    'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  if (!rows.length) throw new ApiError(404, '用户不存在');

  const valid = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!valid) throw new ApiError(400, '当前密码不正确');

  const passwordHash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
    passwordHash,
    userId,
  ]);
  return { ok: true };
}

export async function listRecords(userId, options = {}) {
  const type = ['lesson', 'question'].includes(options.type) ? options.type : null;
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 100));

  const rows = await query(
    `SELECT lr.id, lr.record_type, lr.result, lr.duration_seconds, lr.created_at,
            lr.question_id,
            l.lesson_code, l.title AS lesson_title,
            c.course_code, c.title AS course_title,
            q.question_code, q.title AS question_title, q.difficulty,
            (SELECT COUNT(*) FROM submissions s
              WHERE s.user_id = lr.user_id AND s.question_id = lr.question_id) AS attempt_count
       FROM learning_records lr
       LEFT JOIN lessons l ON l.id = lr.lesson_id
       LEFT JOIN chapters ch ON ch.id = l.chapter_id
       LEFT JOIN courses c ON c.id = ch.course_id
       LEFT JOIN questions q ON q.id = lr.question_id
      WHERE lr.user_id = ?${type ? ' AND lr.record_type = ?' : ''}
      ORDER BY lr.created_at DESC
      LIMIT ?`,
    type ? [userId, type, limit] : [userId, limit],
  );

  return rows.map((row) => {
    const isLesson = row.record_type === 'lesson';
    const attempts = Number(row.attempt_count) || 0;
    const minutes = Math.round((Number(row.duration_seconds) || 0) / 60);
    const difficultyName =
      Number(row.difficulty) <= 2
        ? '入门'
        : Number(row.difficulty) === 3
          ? '进阶'
          : '挑战';
    return {
      id: String(row.id),
      type: isLesson ? 'lesson' : 'problem',
      title: isLesson
        ? row.course_title || row.lesson_title || '课程学习'
        : `${row.question_code || ''} ${row.question_title || ''}`.trim(),
      subtitle: isLesson
        ? row.lesson_title || ''
        : `练习 · ${difficultyName}`,
      time: clockTime(row.created_at),
      date: row.created_at,
      group: recordGroup(row.created_at),
      status: isLesson ? 'completed' : row.result,
      detail: isLesson
        ? `${row.result === 'completed' ? '已完成' : '学习中'} · ${minutes} 分钟`
        : `${row.result === 'passed' ? '已通过' : '未通过'} · ${attempts} 次尝试`,
      action: isLesson ? '继续学习' : '再练一次',
      href: isLesson
        ? row.lesson_code && row.course_code
          ? `/learn/${row.course_code}/${row.lesson_code}`
          : '/courses'
        : row.question_code
          ? `/practice/${row.question_code}`
          : '/practice',
    };
  });
}

export async function listMessages(userId) {
  const rows = await query(
    `SELECT m.id, m.title, m.content, m.message_type, m.is_read, m.created_at,
            m.action_type, m.action_id,
            l.lesson_code, c.course_code, q.question_code
       FROM messages m
       LEFT JOIN lessons l ON m.action_type = 'lesson' AND l.id = m.action_id
       LEFT JOIN chapters ch ON ch.id = l.chapter_id
       LEFT JOIN courses c ON c.id = ch.course_id
       LEFT JOIN questions q ON m.action_type = 'question' AND q.id = m.action_id
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC`,
    [userId],
  );

  return rows.map((row) => {
    let href;
    if (row.action_type === 'lesson' && row.lesson_code && row.course_code) {
      href = `/learn/${row.course_code}/${row.lesson_code}`;
    } else if (row.action_type === 'question' && row.question_code) {
      href = `/practice/${row.question_code}`;
    } else if (row.action_type === 'achievement') {
      href = '/profile/achievements';
    } else if (row.action_type === 'page') {
      href = '/courses';
    }

    return {
      id: String(row.id),
      type: row.message_type,
      title: row.title,
      summary: row.content,
      time: messageTime(row.created_at),
      href,
      unread: !row.is_read,
    };
  });
}

export async function listAchievements(userId) {
  const rows = await query(
    `SELECT a.id, a.code, a.name, a.description, a.condition_desc, a.sort_order,
            ua.unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua
         ON ua.achievement_id = a.id AND ua.user_id = ?
      ORDER BY a.sort_order, a.id`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.code,
    name: row.name,
    condition: row.condition_desc,
    description: row.description,
    icon: ACHIEVEMENT_ICONS[row.code] || 'trophy',
    unlockedAt: dotDate(row.unlocked_at),
  }));
}
