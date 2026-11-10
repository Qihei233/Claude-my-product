import { query } from '../config/db.js';
import { ApiError } from '../utils/http.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

function csvDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function maskPhone(phone) {
  return phone ? String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : null;
}

function maskEmail(email) {
  if (!email) return null;
  const [name, domain] = String(email).split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

function paging(input = {}) {
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function like(value) {
  return `%${String(value || '').trim()}%`;
}

function last7Days() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    days.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return days;
}

function mapUser(row) {
  return {
    id: String(row.id),
    nickname: row.nickname,
    phone: maskPhone(row.phone),
    email: maskEmail(row.email),
    role: row.role,
    status: row.status,
    level: Number(row.level) || 1,
    exp: Number(row.exp) || 0,
    streakDays: Number(row.streak_days) || 0,
    studyMinutes: Number(row.total_study_minutes) || 0,
    onboardingCompleted: Boolean(row.onboarding_completed),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function loginOverview(input) {
  return input;
}

export async function getOverview() {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM users WHERE created_at >= CURDATE()) AS users_today,
       (SELECT COUNT(DISTINCT user_id) FROM user_daily_stats
          WHERE stat_date >= CURDATE() - INTERVAL 6 DAY) AS active_7,
       (SELECT COUNT(*) FROM courses WHERE status = 'published') AS courses,
       (SELECT COUNT(*) FROM lessons WHERE status = 'published') AS lessons,
       (SELECT COUNT(*) FROM questions WHERE status = 'published') AS questions,
       (SELECT COUNT(*) FROM submissions) AS submissions,
       (SELECT COUNT(*) FROM submissions WHERE result = 'accepted') AS accepted,
       (SELECT COUNT(*) FROM submissions WHERE submitted_at >= CURDATE()) AS submissions_today`,
  );
  const stats = rows[0];

  const userTrendRows = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS total
       FROM users
      WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY day`,
  );
  const studyTrendRows = await query(
    `SELECT DATE_FORMAT(stat_date, '%Y-%m-%d') AS day, COALESCE(SUM(study_minutes), 0) AS minutes
       FROM user_daily_stats
      WHERE stat_date >= CURDATE() - INTERVAL 6 DAY
      GROUP BY day`,
  );
  const userTrendMap = new Map(userTrendRows.map((row) => [row.day, Number(row.total)]));
  const studyTrendMap = new Map(
    studyTrendRows.map((row) => [row.day, Number(row.minutes)]),
  );
  const trend = last7Days().map((day) => ({
    date: day,
    users: userTrendMap.get(day) || 0,
    studyMinutes: studyTrendMap.get(day) || 0,
  }));

  const topCourses = await query(
    `SELECT id, course_code, title, category, learner_count, lesson_count
       FROM v_course_overview
      ORDER BY learner_count DESC, rating DESC
      LIMIT 5`,
  );

  const recentUsers = await query(
    `SELECT u.id, u.nickname, u.phone, u.email, u.role, u.status,
            u.created_at, u.last_login_at,
            p.level, p.exp, p.streak_days, p.total_study_minutes,
            p.onboarding_completed
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 5`,
  );

  return {
    stats: {
      users: Number(stats.users),
      usersToday: Number(stats.users_today),
      active7: Number(stats.active_7),
      courses: Number(stats.courses),
      lessons: Number(stats.lessons),
      questions: Number(stats.questions),
      submissions: Number(stats.submissions),
      submissionsToday: Number(stats.submissions_today),
      passRate: stats.submissions
        ? Number(((Number(stats.accepted) / Number(stats.submissions)) * 100).toFixed(1))
        : 0,
    },
    trend,
    topCourses: topCourses.map((row) => ({
      id: String(row.id),
      courseCode: row.course_code,
      title: row.title,
      category: row.category,
      learnerCount: Number(row.learner_count),
      lessonCount: Number(row.lesson_count),
    })),
    recentUsers: recentUsers.map(mapUser),
  };
}

export async function listUsers(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];

  if (input.keyword?.trim()) {
    where.push('(u.nickname LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)');
    params.push(like(input.keyword), like(input.keyword), like(input.keyword));
  }
  if (['active', 'disabled'].includes(input.status)) {
    where.push('u.status = ?');
    params.push(input.status);
  }
  if (input.start) {
    where.push('u.created_at >= ?');
    params.push(`${input.start} 00:00:00`);
  }
  if (input.end) {
    where.push('u.created_at <= ?');
    params.push(`${input.end} 23:59:59`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT u.id, u.nickname, u.phone, u.email, u.role, u.status,
            u.created_at, u.last_login_at,
            p.level, p.exp, p.streak_days, p.total_study_minutes,
            p.onboarding_completed,
            COUNT(*) OVER() AS total
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    list: rows.map(mapUser),
    total: rows.length ? Number(rows[0].total) : 0,
    page,
    pageSize,
  };
}

export async function getUserDetail(userId) {
  const baseRows = await query(
    `SELECT u.id, u.nickname, u.phone, u.email, u.role, u.status,
            u.created_at, u.last_login_at,
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
  if (!baseRows.length) throw new ApiError(404, '用户不存在');

  const [
    summaryRows,
    enrollmentRows,
    progressRows,
    submissionRows,
    recordRows,
    statsRows,
    achievementRows,
    interestRows,
    masteryRows,
    messageRows,
    favoriteRows,
  ] = await Promise.all([
    query('SELECT * FROM v_user_learning_summary WHERE user_id = ? LIMIT 1', [userId]),
    query(
      `SELECT e.status, e.progress_percent, e.enrolled_at, e.completed_at,
              c.course_code, c.title
         FROM course_enrollments e
         JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = ?
        ORDER BY e.updated_at DESC`,
      [userId],
    ),
    query(
      `SELECT lp.status, lp.progress_percent, lp.updated_at,
              l.lesson_code, l.title AS lesson_title, c.title AS course_title
         FROM user_lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN chapters ch ON ch.id = l.chapter_id
         JOIN courses c ON c.id = ch.course_id
        WHERE lp.user_id = ?
        ORDER BY lp.updated_at DESC
        LIMIT 30`,
      [userId],
    ),
    query(
      `SELECT s.result, s.passed_cases, s.total_cases, s.runtime_ms,
              s.attempt_no, s.is_first_attempt_pass, s.submitted_at,
              q.question_code, q.title AS question_title
         FROM submissions s
         JOIN questions q ON q.id = s.question_id
        WHERE s.user_id = ?
        ORDER BY s.submitted_at DESC
        LIMIT 20`,
      [userId],
    ),
    query(
      `SELECT lr.record_type, lr.result, lr.duration_seconds, lr.created_at,
              l.title AS lesson_title, q.title AS question_title
         FROM learning_records lr
         LEFT JOIN lessons l ON l.id = lr.lesson_id
         LEFT JOIN questions q ON q.id = lr.question_id
        WHERE lr.user_id = ?
        ORDER BY lr.created_at DESC
        LIMIT 20`,
      [userId],
    ),
    query(
      `SELECT stat_date, study_minutes, lessons_completed, questions_attempted,
              questions_passed, exp_earned, streak_days
         FROM user_daily_stats
        WHERE user_id = ?
        ORDER BY stat_date DESC
        LIMIT 30`,
      [userId],
    ),
    query(
      `SELECT a.code, a.name, a.description, ua.unlocked_at
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = ?
        ORDER BY ua.unlocked_at DESC`,
      [userId],
    ),
    query(
      'SELECT interest, weight, created_at FROM user_interests WHERE user_id = ? ORDER BY weight DESC',
      [userId],
    ),
    query(
      `SELECT m.knowledge_point_id, m.score, m.attempts, m.correct_count,
              m.last_practiced_at, kp.name AS knowledge_point_name
         FROM mastery_scores m
         JOIN knowledge_points kp ON kp.id = m.knowledge_point_id
        WHERE m.user_id = ?
        ORDER BY m.score ASC`,
      [userId],
    ),
    query(
      `SELECT title, content, message_type, is_read, created_at
         FROM messages
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10`,
      [userId],
    ),
    query(
      `SELECT f.target_type, f.target_id, f.created_at,
              c.course_code, c.title AS course_title,
              q.question_code, q.title AS question_title
         FROM favorites f
         LEFT JOIN courses c ON f.target_type = 'course' AND c.id = f.target_id
         LEFT JOIN questions q ON f.target_type = 'question' AND q.id = f.target_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT 10`,
      [userId],
    ),
  ]);

  const base = baseRows[0];
  return {
    user: {
      ...mapUser(base),
      pythonBase: base.python_base,
      longestStreakDays: Number(base.longest_streak_days) || 0,
      dailyGoalMinutes: Number(base.daily_goal_minutes) || 30,
      bio: base.bio || '',
      preferences: {
        studyReminderEnabled: Boolean(base.study_reminder_enabled),
        reminderTime: base.reminder_time ? String(base.reminder_time).slice(0, 5) : '',
        achievementNotificationEnabled: Boolean(base.achievement_notification_enabled),
        codeFontSize: Number(base.code_font_size) || 14,
        defaultHome: base.default_home || 'home',
      },
    },
    summary: summaryRows[0] || null,
    enrollments: enrollmentRows,
    progress: progressRows,
    submissions: submissionRows,
    records: recordRows,
    dailyStats: statsRows,
    achievements: achievementRows,
    interests: interestRows,
    mastery: masteryRows,
    messages: messageRows,
    favorites: favoriteRows,
  };
}

export async function listCourses(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];

  if (input.keyword?.trim()) {
    where.push('(v.title LIKE ? OR v.course_code LIKE ?)');
    params.push(like(input.keyword), like(input.keyword));
  }
  if (input.category) {
    where.push('v.category = ?');
    params.push(input.category);
  }
  if (input.difficulty) {
    where.push('v.difficulty = ?');
    params.push(input.difficulty);
  }
  if (input.status) {
    where.push('c.status = ?');
    params.push(input.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT v.id, v.course_code, v.title, v.category, v.difficulty,
            v.rating, v.learner_count, v.lesson_count, v.total_duration_minutes,
            c.status, c.created_at, COUNT(*) OVER() AS total
       FROM v_course_overview v
       JOIN courses c ON c.id = v.id
       ${whereSql}
      ORDER BY v.id
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    list: rows.map((row) => ({
      id: String(row.id),
      courseCode: row.course_code,
      title: row.title,
      category: row.category,
      difficulty: row.difficulty,
      rating: Number(row.rating),
      learnerCount: Number(row.learner_count),
      lessonCount: Number(row.lesson_count),
      durationMinutes: Number(row.total_duration_minutes),
      status: row.status,
      createdAt: row.created_at,
    })),
    total: rows.length ? Number(rows[0].total) : 0,
    page,
    pageSize,
  };
}

export async function getCourseDetail(courseId) {
  const rows = await query(
    `SELECT c.id, c.course_code, c.title, c.description, c.category,
            c.difficulty, c.rating, c.is_free, c.status, c.created_at,
            v.learner_count, v.lesson_count, v.total_duration_minutes
       FROM courses c
       LEFT JOIN v_course_overview v ON v.id = c.id
      WHERE c.id = ?
      LIMIT 1`,
    [courseId],
  );
  if (!rows.length) throw new ApiError(404, '课程不存在');

  const [chapterRows, knowledgeRows, questionRows] = await Promise.all([
    query(
      `SELECT ch.id AS chapter_id, ch.title AS chapter_title, ch.sort_order,
              l.id AS lesson_id, l.lesson_code, l.title AS lesson_title,
              l.lesson_type, l.duration_minutes, l.difficulty, l.status
         FROM chapters ch
         LEFT JOIN lessons l ON l.chapter_id = ch.id
        WHERE ch.course_id = ?
        ORDER BY ch.sort_order, l.sort_order`,
      [courseId],
    ),
    query(
      `SELECT id, name, description, difficulty, sort_order
         FROM knowledge_points WHERE course_id = ? ORDER BY sort_order`,
      [courseId],
    ),
    query(
      `SELECT DISTINCT q.id, q.question_code, q.title, q.difficulty
         FROM lessons l
         JOIN questions q ON q.id = l.question_id
         JOIN chapters ch ON ch.id = l.chapter_id
        WHERE ch.course_id = ?
        ORDER BY q.id`,
      [courseId],
    ),
  ]);

  const chapters = [];
  const byId = new Map();
  for (const row of chapterRows) {
    if (!byId.has(row.chapter_id)) {
      const chapter = {
        id: String(row.chapter_id),
        title: row.chapter_title,
        lessons: [],
      };
      byId.set(row.chapter_id, chapter);
      chapters.push(chapter);
    }
    if (row.lesson_id) {
      byId.get(row.chapter_id).lessons.push({
        id: String(row.lesson_id),
        code: row.lesson_code,
        title: row.lesson_title,
        type: row.lesson_type,
        durationMinutes: Number(row.duration_minutes),
        difficulty: Number(row.difficulty),
        status: row.status,
      });
    }
  }

  return {
    course: {
      id: String(rows[0].id),
      courseCode: rows[0].course_code,
      title: rows[0].title,
      description: rows[0].description,
      category: rows[0].category,
      difficulty: rows[0].difficulty,
      rating: Number(rows[0].rating),
      isFree: Boolean(rows[0].is_free),
      status: rows[0].status,
      createdAt: rows[0].created_at,
      learnerCount: Number(rows[0].learner_count) || 0,
      lessonCount: Number(rows[0].lesson_count) || 0,
      durationMinutes: Number(rows[0].total_duration_minutes) || 0,
    },
    chapters,
    knowledgePoints: knowledgeRows,
    linkedQuestions: questionRows,
  };
}

export async function listQuestions(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];

  if (input.keyword?.trim()) {
    where.push('(q.title LIKE ? OR q.question_code LIKE ?)');
    params.push(like(input.keyword), like(input.keyword));
  }
  if (input.difficulty) {
    where.push('q.difficulty = ?');
    params.push(Number(input.difficulty));
  }
  if (input.status) {
    where.push('q.status = ?');
    params.push(input.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT q.id, q.question_code, q.title, q.difficulty, q.status,
            (SELECT COUNT(*) FROM submissions s WHERE s.question_id = q.id) AS attempts,
            (SELECT COUNT(*) FROM submissions s WHERE s.question_id = q.id AND s.result = 'accepted') AS accepted,
            COUNT(*) OVER() AS total
       FROM questions q
       ${whereSql}
      ORDER BY q.id
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    list: rows.map((row) => ({
      id: String(row.id),
      code: row.question_code,
      title: row.title,
      difficulty: Number(row.difficulty),
      status: row.status,
      attempts: Number(row.attempts),
      accepted: Number(row.accepted),
      passRate: Number(row.attempts)
        ? Number(((Number(row.accepted) / Number(row.attempts)) * 100).toFixed(1))
        : 0,
    })),
    total: rows.length ? Number(rows[0].total) : 0,
    page,
    pageSize,
  };
}

export async function getQuestionDetail(questionId) {
  const rows = await query(
    `SELECT id, question_code, title, description, difficulty, sample_input,
            sample_output, initial_code, hints, solution, status, created_at
       FROM questions WHERE id = ? LIMIT 1`,
    [questionId],
  );
  if (!rows.length) throw new ApiError(404, '题目不存在');

  const [cases, knowledgeRows] = await Promise.all([
    query(
      `SELECT id, input_text, expected_output, is_sample, sort_order
         FROM test_cases WHERE question_id = ? ORDER BY sort_order`,
      [questionId],
    ),
    query(
      `SELECT kp.id, kp.name FROM question_knowledge_points qkp
         JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
        WHERE qkp.question_id = ?`,
      [questionId],
    ),
  ]);

  return { question: rows[0], testCases: cases, knowledgePoints: knowledgeRows };
}

function listQuery({ select, from, where, params, order, pageSize, offset }) {
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return query(
    `${select}, COUNT(*) OVER() AS total FROM ${from} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
}

function listResult(rows, page, pageSize, mapper = (row) => row) {
  return {
    list: rows.map(({ total, ...row }) => mapper(row)),
    total: rows.length ? Number(rows[0].total) : 0,
    page,
    pageSize,
  };
}

export async function listRecords(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('(u.nickname LIKE ? OR l.title LIKE ? OR q.title LIKE ?)');
    params.push(like(input.keyword), like(input.keyword), like(input.keyword));
  }
  if (['lesson', 'question'].includes(input.type)) {
    where.push('lr.record_type = ?');
    params.push(input.type);
  }
  if (input.start) {
    where.push('lr.created_at >= ?');
    params.push(`${input.start} 00:00:00`);
  }
  if (input.end) {
    where.push('lr.created_at <= ?');
    params.push(`${input.end} 23:59:59`);
  }

  const rows = await listQuery({
    select: `SELECT lr.id, lr.record_type, lr.result, lr.duration_seconds, lr.created_at,
                    u.id AS user_id, u.nickname,
                    l.lesson_code, l.title AS lesson_title,
                    c.title AS course_title,
                    q.question_code, q.title AS question_title`,
    from: `learning_records lr
           JOIN users u ON u.id = lr.user_id
           LEFT JOIN lessons l ON l.id = lr.lesson_id
           LEFT JOIN chapters ch ON ch.id = l.chapter_id
           LEFT JOIN courses c ON c.id = ch.course_id
           LEFT JOIN questions q ON q.id = lr.question_id`,
    where,
    params,
    order: 'lr.created_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: row.nickname,
    type: row.record_type,
    title: row.course_title || row.lesson_title || row.question_title,
    detail: row.lesson_title || row.question_title || '',
    result: row.result,
    minutes: Math.round(Number(row.duration_seconds) / 60),
    createdAt: row.created_at,
  }));
}

export async function listSubmissions(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('(u.nickname LIKE ? OR q.title LIKE ? OR q.question_code LIKE ?)');
    params.push(like(input.keyword), like(input.keyword), like(input.keyword));
  }
  if (input.result) {
    where.push('s.result = ?');
    params.push(input.result);
  }
  if (input.start) {
    where.push('s.submitted_at >= ?');
    params.push(`${input.start} 00:00:00`);
  }
  if (input.end) {
    where.push('s.submitted_at <= ?');
    params.push(`${input.end} 23:59:59`);
  }

  const rows = await listQuery({
    select: `SELECT s.id, s.result, s.passed_cases, s.total_cases, s.runtime_ms,
                    s.hint_level_used, s.attempt_no, s.is_first_attempt_pass, s.submitted_at,
                    u.id AS user_id, u.nickname,
                    q.question_code, q.title AS question_title`,
    from: `submissions s
           JOIN users u ON u.id = s.user_id
           JOIN questions q ON q.id = s.question_id`,
    where,
    params,
    order: 's.submitted_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: row.nickname,
    questionCode: row.question_code,
    questionTitle: row.question_title,
    result: row.result,
    passedCases: Number(row.passed_cases),
    totalCases: Number(row.total_cases),
    runtimeMs: Number(row.runtime_ms),
    hintLevel: Number(row.hint_level_used),
    attemptNo: Number(row.attempt_no),
    firstPass: Boolean(row.is_first_attempt_pass),
    submittedAt: row.submitted_at,
  }));
}

export async function listProgress(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('(u.nickname LIKE ? OR l.title LIKE ? OR c.title LIKE ?)');
    params.push(like(input.keyword), like(input.keyword), like(input.keyword));
  }
  if (input.status) {
    where.push('lp.status = ?');
    params.push(input.status);
  }

  const rows = await listQuery({
    select: `SELECT lp.user_id, u.nickname, lp.status, lp.progress_percent, lp.updated_at,
                    l.lesson_code, l.title AS lesson_title, c.title AS course_title`,
    from: `user_lesson_progress lp
           JOIN users u ON u.id = lp.user_id
           JOIN lessons l ON l.id = lp.lesson_id
           JOIN chapters ch ON ch.id = l.chapter_id
           JOIN courses c ON c.id = ch.course_id`,
    where,
    params,
    order: 'lp.updated_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    userId: String(row.user_id),
    nickname: row.nickname,
    courseTitle: row.course_title,
    lessonTitle: row.lesson_title,
    lessonCode: row.lesson_code,
    status: row.status,
    progress: Number(row.progress_percent),
    updatedAt: row.updated_at,
  }));
}

export async function listDailyStats(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('u.nickname LIKE ?');
    params.push(like(input.keyword));
  }
  if (input.start) {
    where.push('s.stat_date >= ?');
    params.push(input.start);
  }
  if (input.end) {
    where.push('s.stat_date <= ?');
    params.push(input.end);
  }

  const rows = await listQuery({
    select: `SELECT s.user_id, u.nickname,
                    DATE_FORMAT(s.stat_date, '%Y-%m-%d') AS stat_date,
                    s.study_minutes,
                    s.lessons_completed, s.questions_attempted, s.questions_passed,
                    s.exp_earned, s.streak_days`,
    from: `user_daily_stats s JOIN users u ON u.id = s.user_id`,
    where,
    params,
    order: 's.stat_date DESC, s.user_id',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    userId: String(row.user_id),
    nickname: row.nickname,
    date: row.stat_date,
    studyMinutes: Number(row.study_minutes),
    lessonsCompleted: Number(row.lessons_completed),
    questionsAttempted: Number(row.questions_attempted),
    questionsPassed: Number(row.questions_passed),
    expEarned: Number(row.exp_earned),
    streakDays: Number(row.streak_days),
  }));
}

export async function listMastery(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('(u.nickname LIKE ? OR v.knowledge_point_name LIKE ?)');
    params.push(like(input.keyword), like(input.keyword));
  }

  const rows = await listQuery({
    select: `SELECT v.user_id, u.nickname, v.knowledge_point_name, v.score,
                    v.attempts, v.correct_count, v.base_difficulty, v.target_difficulty`,
    from: `v_mastery_target v JOIN users u ON u.id = v.user_id`,
    where,
    params,
    order: 'v.score ASC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    userId: String(row.user_id),
    nickname: row.nickname,
    knowledgePoint: row.knowledge_point_name,
    score: Number(row.score),
    attempts: Number(row.attempts),
    correctCount: Number(row.correct_count),
    targetDifficulty: Number(row.target_difficulty),
  }));
}

export async function getLeaderboard() {
  const rows = await query(
    `SELECT v.user_id, v.nickname, v.week_study_minutes, v.week_questions_passed,
            v.week_exp, COALESCE(p.level, 1) AS level
       FROM v_weekly_leaderboard v
       LEFT JOIN user_profiles p ON p.user_id = v.user_id
      ORDER BY v.week_study_minutes DESC, v.week_questions_passed DESC`,
  );
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id),
    nickname: row.nickname,
    level: Number(row.level),
    weekStudyMinutes: Number(row.week_study_minutes),
    weekQuestionsPassed: Number(row.week_questions_passed),
    weekExp: Number(row.week_exp),
  }));
}

export async function listMessages(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('(u.nickname LIKE ? OR m.title LIKE ?)');
    params.push(like(input.keyword), like(input.keyword));
  }
  if (input.type) {
    where.push('m.message_type = ?');
    params.push(input.type);
  }

  const rows = await listQuery({
    select: `SELECT m.id, m.title, m.content, m.message_type, m.is_read,
                    m.created_at, m.read_at, u.id AS user_id, u.nickname`,
    from: `messages m JOIN users u ON u.id = m.user_id`,
    where,
    params,
    order: 'm.created_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: row.nickname,
    title: row.title,
    content: row.content,
    type: row.message_type,
    read: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function listFavorites(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('u.nickname LIKE ?');
    params.push(like(input.keyword));
  }

  const rows = await listQuery({
    select: `SELECT f.id, f.target_type, f.target_id, f.created_at,
                    u.id AS user_id, u.nickname,
                    c.title AS course_title, q.title AS question_title`,
    from: `favorites f
           JOIN users u ON u.id = f.user_id
           LEFT JOIN courses c ON f.target_type = 'course' AND c.id = f.target_id
           LEFT JOIN questions q ON f.target_type = 'question' AND q.id = f.target_id`,
    where,
    params,
    order: 'f.created_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: row.nickname,
    targetType: row.target_type,
    targetTitle:
      row.course_title || row.question_title || `#${row.target_id}`,
    createdAt: row.created_at,
  }));
}

export async function listRecommendations(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('u.nickname LIKE ?');
    params.push(like(input.keyword));
  }

  const rows = await listQuery({
    select: `SELECT r.id, r.rec_type, r.reason, r.priority, r.status, r.created_at,
                    u.id AS user_id, u.nickname,
                    c.title AS course_title, l.title AS lesson_title,
                    q.title AS question_title, kp.name AS knowledge_point_name`,
    from: `learning_recommendations r
           JOIN users u ON u.id = r.user_id
           LEFT JOIN courses c ON c.id = r.course_id
           LEFT JOIN lessons l ON l.id = r.lesson_id
           LEFT JOIN questions q ON q.id = r.question_id
           LEFT JOIN knowledge_points kp ON kp.id = r.knowledge_point_id`,
    where,
    params,
    order: 'r.created_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: row.nickname,
    type: row.rec_type,
    target:
      row.course_title || row.lesson_title || row.question_title || row.knowledge_point_name,
    reason: row.reason,
    priority: Number(row.priority),
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function listReports(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const where = [];
  const params = [];
  if (input.keyword?.trim()) {
    where.push('u.nickname LIKE ?');
    params.push(like(input.keyword));
  }

  const rows = await listQuery({
    select: `SELECT r.id, r.period_type,
                    DATE_FORMAT(r.period_start, '%Y-%m-%d') AS period_start,
                    DATE_FORMAT(r.period_end, '%Y-%m-%d') AS period_end,
                    r.study_minutes, r.lessons_completed, r.questions_attempted,
                    r.questions_passed, r.accuracy_percent, r.streak_days,
                    r.generated_at, u.id AS user_id, u.nickname`,
    from: `reports r JOIN users u ON u.id = r.user_id`,
    where,
    params,
    order: 'r.generated_at DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    nickname: row.nickname,
    periodType: row.period_type,
    period: `${row.period_start} ~ ${row.period_end}`,
    studyMinutes: Number(row.study_minutes),
    lessonsCompleted: Number(row.lessons_completed),
    questionsAttempted: Number(row.questions_attempted),
    questionsPassed: Number(row.questions_passed),
    accuracy: Number(row.accuracy_percent),
    streakDays: Number(row.streak_days),
    generatedAt: row.generated_at,
  }));
}

export async function listDailyQuestions(input = {}) {
  const { page, pageSize, offset } = paging(input);
  const rows = await listQuery({
    select: `SELECT dq.id, DATE_FORMAT(dq.question_date, '%Y-%m-%d') AS question_date,
                    q.question_code, q.title, q.difficulty, q.status`,
    from: `daily_questions dq JOIN questions q ON q.id = dq.question_id`,
    where: [],
    params: [],
    order: 'dq.question_date DESC',
    pageSize,
    offset,
  });

  return listResult(rows, page, pageSize, (row) => ({
    id: String(row.id),
    date: row.question_date,
    questionCode: row.question_code,
    title: row.title,
    difficulty: Number(row.difficulty),
    status: row.status,
  }));
}

export async function exportRows(type, input = {}) {
  if (type === 'users') {
    const rows = [];
    let page = 1;
    while (rows.length < 10000) {
      const data = await listUsers({ ...input, page, pageSize: 100 });
      rows.push(...data.list);
      if (rows.length >= data.total || !data.list.length) break;
      page += 1;
    }
    return {
      headers: ['ID', '昵称', '手机号', '邮箱', '角色', '状态', '等级', '经验', '注册时间', '最后登录'],
      rows: rows.slice(0, 10000).map((row) => [
        row.id,
        row.nickname,
        row.phone || '',
        row.email || '',
        row.role,
        row.status,
        row.level,
        row.exp,
        csvDateTime(row.createdAt),
        csvDateTime(row.lastLoginAt),
      ]),
      filename: `naiwa_users_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  if (type === 'records') {
    const rows = [];
    let page = 1;
    while (rows.length < 10000) {
      const data = await listRecords({ ...input, page, pageSize: 100 });
      rows.push(...data.list);
      if (rows.length >= data.total || !data.list.length) break;
      page += 1;
    }
    return {
      headers: ['用户', '类型', '内容', '结果', '时长(分钟)', '时间'],
      rows: rows.slice(0, 10000).map((row) => [
        row.nickname,
        row.type,
        row.title,
        row.result,
        row.minutes,
        csvDateTime(row.createdAt),
      ]),
      filename: `naiwa_records_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  if (type === 'submissions') {
    const rows = [];
    let page = 1;
    while (rows.length < 10000) {
      const data = await listSubmissions({ ...input, page, pageSize: 100 });
      rows.push(...data.list);
      if (rows.length >= data.total || !data.list.length) break;
      page += 1;
    }
    return {
      headers: ['用户', '题目', '结果', '通过用例', '总用例', '耗时(ms)', '尝试次数', '提交时间'],
      rows: rows.slice(0, 10000).map((row) => [
        row.nickname,
        `${row.questionCode} ${row.questionTitle}`,
        row.result,
        row.passedCases,
        row.totalCases,
        row.runtimeMs,
        row.attemptNo,
        csvDateTime(row.submittedAt),
      ]),
      filename: `naiwa_submissions_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  throw new ApiError(400, '不支持的导出类型');
}
