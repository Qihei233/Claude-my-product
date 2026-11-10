import { query } from '../config/db.js';
import { ApiError } from '../utils/http.js';

const CATEGORY_KEYS = {
  基础语法: 'basic',
  办公自动化: 'office',
  数据分析: 'data',
  趣味编程: 'fun',
};

const COURSE_META = {
  'py-basic-01': {
    icon: 'terminal',
    eyebrow: '零基础 · 入门首选',
    outcomes: ['写出你的第一行 Python 代码', '理解变量、字符串与条件循环', '独立完成一个小练习'],
    audience: ['完全没有编程基础的同学', '想用碎片时间入门 Python 的同学'],
  },
  'excel-auto-01': {
    icon: 'excel',
    eyebrow: '办公 · 效率提升',
    outcomes: ['用 Python 批量读取表格', '自动整理重复的办公任务'],
    audience: ['经常处理 Excel 的办公族', '希望减少重复劳动的同学'],
  },
  'data-analysis-01': {
    icon: 'pie',
    eyebrow: '数据 · 分析入门',
    outcomes: ['用 pandas 读取与清洗数据', '完成一次基础数据分析'],
    audience: ['对数据分析感兴趣的同学', '需要处理课程数据的同学'],
  },
  'game-dev-01': {
    icon: 'gamepad',
    eyebrow: '趣味 · 项目实战',
    outcomes: ['理解游戏主循环', '写出一个可玩的小游戏'],
    audience: ['喜欢游戏与动手实践的同学', '想完成第一个项目的同学'],
  },
};

const DEFAULT_META = {
  icon: 'terminal',
  eyebrow: 'Python 学习',
  outcomes: ['掌握课程核心知识', '完成配套练习'],
  audience: ['对 Python 感兴趣的同学'],
};

const QUESTION_ICON_FALLBACK = 'terminal';

function courseMeta(code) {
  return COURSE_META[code] || DEFAULT_META;
}

function categoryKey(label) {
  return CATEGORY_KEYS[label] || 'basic';
}

function difficultyLabel(level) {
  if (level <= 2) return 'beginner';
  if (level === 3) return 'intermediate';
  return 'challenge';
}

function toCourse(row, chapterRows) {
  const meta = courseMeta(row.course_code);
  return {
    id: row.course_code,
    title: row.title,
    eyebrow: meta.eyebrow,
    description: row.description,
    category: categoryKey(row.category),
    categoryLabel: row.category,
    difficulty: row.difficulty,
    icon: meta.icon,
    lessonCount: Number(row.lesson_count ?? 0),
    durationMinutes: Number(row.total_duration_minutes ?? 0),
    learnerCount: Number(row.learner_count ?? 0),
    rating: Number(row.rating ?? 0),
    outcomes: meta.outcomes,
    audience: meta.audience,
    chapters: chapterRows ? buildChapters(chapterRows) : [],
  };
}

function buildChapters(rows) {
  const chapters = new Map();
  for (const row of rows) {
    if (!chapters.has(row.chapter_id)) {
      chapters.set(row.chapter_id, {
        id: String(row.chapter_id),
        title: row.chapter_title,
        lessons: [],
      });
    }
    if (row.lesson_id) {
      chapters.get(row.chapter_id).lessons.push({
        id: row.lesson_code,
        chapterId: String(row.chapter_id),
        title: row.lesson_title,
        type: row.lesson_type,
        order: row.lesson_sort_order,
      });
    }
  }
  return Array.from(chapters.values());
}

const COURSE_BASE = `
  SELECT c.id, c.course_code, c.title, c.description, c.category, c.difficulty,
         c.rating, c.is_free, c.status, c.sort_order,
         v.learner_count, v.lesson_count, v.total_duration_minutes
    FROM courses c
    LEFT JOIN v_course_overview v ON v.id = c.id
   WHERE c.status = 'published'`;

const COURSE_SELECT = `${COURSE_BASE} ORDER BY c.sort_order, c.id`;

async function chaptersForCourseIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  return query(
    `SELECT ch.id AS chapter_id, ch.course_id, ch.title AS chapter_title,
            ch.sort_order AS chapter_sort,
            l.id AS lesson_id, l.lesson_code, l.title AS lesson_title,
            l.lesson_type, l.duration_minutes, l.difficulty,
            l.sort_order AS lesson_sort_order
       FROM chapters ch
       LEFT JOIN lessons l ON l.chapter_id = ch.id AND l.status = 'published'
      WHERE ch.course_id IN (${placeholders})
      ORDER BY ch.sort_order, l.sort_order`,
    ids,
  );
}

export async function listCourses() {
  const rows = await query(COURSE_SELECT);
  const chapterRows = await chaptersForCourseIds(rows.map((row) => row.id));
  const byCourse = new Map();
  for (const row of chapterRows) {
    if (!byCourse.has(row.course_id)) byCourse.set(row.course_id, []);
    byCourse.get(row.course_id).push(row);
  }
  return rows.map((row) => toCourse(row, byCourse.get(row.id) || []));
}

export async function getCourseByCode(code) {
  const rows = await query(`${COURSE_BASE} AND c.course_code = ? LIMIT 1`, [code]);
  if (!rows.length) throw new ApiError(404, '课程不存在');
  const chapterRows = await chaptersForCourseIds([rows[0].id]);
  return toCourse(rows[0], chapterRows);
}

const QUESTION_BASE = `
  SELECT q.id, q.question_code, q.title, q.description, q.sample_input,
         q.sample_output, q.initial_code, q.hints, q.solution, q.difficulty,
         q.status, q.created_at,
         GROUP_CONCAT(DISTINCT kp.name ORDER BY kp.sort_order SEPARATOR ',') AS tag_names
    FROM questions q
    LEFT JOIN question_knowledge_points qkp ON qkp.question_id = q.id
    LEFT JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
   WHERE q.status = 'published'`;

const QUESTION_SELECT = `${QUESTION_BASE} GROUP BY q.id ORDER BY q.id`;

function toProblem(row) {
  const tags = row.tag_names ? String(row.tag_names).split(',') : [];
  return {
    id: row.question_code,
    number: `#${String(row.id).padStart(3, '0')}`,
    title: row.title,
    difficulty: difficultyLabel(Number(row.difficulty)),
    tags,
    description: row.description,
    task: '按题目要求补全或编写代码，先运行示例，再提交给奶蛙检查。',
    sampleInput: row.sample_input || '无',
    sampleOutput: row.sample_output || '',
    explanation: row.sample_input
      ? `当输入为「${row.sample_input}」时，期望输出「${row.sample_output}」。`
      : '运行示例代码，观察输出是否符合题目要求。',
    initialCode: row.initial_code || '',
    hints: Array.isArray(row.hints) ? row.hints : [],
    solution: row.solution || '',
    solutionIdea: '参考解法见下方代码，先自己尝试，再对照思路。',
    icon: QUESTION_ICON_FALLBACK,
    status: row.status,
  };
}

export async function listProblems() {
  const rows = await query(QUESTION_SELECT);
  return rows.map(toProblem);
}

export async function getProblemByCode(code) {
  const rows = await query(
    `${QUESTION_BASE} AND q.question_code = ? GROUP BY q.id LIMIT 1`,
    [code],
  );
  if (!rows.length) {
    // The question may be unpublished; report a friendly 404 either way.
    throw new ApiError(404, '题目不存在');
  }
  const problem = toProblem(rows[0]);
  const cases = await query(
    `SELECT id, input_text, expected_output, is_sample, sort_order
       FROM test_cases
      WHERE question_id = ?
      ORDER BY sort_order`,
    [rows[0].id],
  );
  return { ...problem, testCases: cases };
}

const LESSON_SELECT = `
  SELECT l.id, l.lesson_code, l.title, l.lesson_type, l.content, l.initial_code,
         l.duration_minutes, l.difficulty, l.is_preview, l.status,
         ch.id AS chapter_id, ch.title AS chapter_title,
         c.id AS course_id, c.course_code, c.title AS course_title
    FROM lessons l
    JOIN chapters ch ON ch.id = l.chapter_id
    JOIN courses c ON c.id = ch.course_id
   WHERE l.lesson_code = ? AND l.status = 'published'
   LIMIT 1`;

function toLessonContent(row) {
  const blocks = Array.isArray(row.content) ? row.content : [];
  const paragraphs = blocks.filter((block) => block.type === 'paragraph' && block.text);
  return {
    intro: paragraphs[0]?.text || `欢迎学习「${row.title}」。先读一读示例，再动手运行。`,
    sections: blocks.map((block) =>
      block.type === 'code'
        ? { title: '动手试一试', code: block.code || '' }
        : { title: '知识点', body: block.text || '' },
    ),
    task:
      row.lesson_type === 'practice'
        ? '独立完成本节练习，先运行示例，再按自己的想法修改代码。'
        : '运行示例代码，并尝试修改文字内容，观察输出发生了什么变化。',
    goal:
      row.lesson_type === 'practice'
        ? '独立完成本节练习并运行通过。'
        : '理解本节示例代码的含义。',
    hint: '先检查引号、括号和缩进，再运行一次。报错是在告诉你下一步该看哪里。',
    initialCode: row.initial_code || '',
    estimatedMinutes: Number(row.duration_minutes) || 10,
  };
}

export async function getLessonByCode(code, userId) {
  const rows = await query(LESSON_SELECT, [code]);
  if (!rows.length) throw new ApiError(404, '课时不存在');
  const row = rows[0];

  let progress = null;
  if (userId) {
    const progressRows = await query(
      `SELECT status, progress_percent
         FROM user_lesson_progress
        WHERE user_id = ? AND lesson_id = ?
        LIMIT 1`,
      [userId, row.id],
    );
    progress = progressRows[0] || null;
  }

  return {
    lesson: {
      id: row.lesson_code,
      chapterId: String(row.chapter_id),
      title: row.title,
      type: row.lesson_type,
      order: 0,
      durationMinutes: Number(row.duration_minutes) || 0,
      difficulty: Number(row.difficulty) || 1,
    },
    course: {
      id: row.course_code,
      title: row.course_title,
    },
    chapter: {
      id: String(row.chapter_id),
      title: row.chapter_title,
    },
    content: toLessonContent(row),
    progress: progress
      ? {
          status: progress.status,
          progressPercent: Number(progress.progress_percent) || 0,
        }
      : { status: 'unlocked', progressPercent: 0 },
  };
}

export async function getWeeklyLeaderboard(userId) {
  const rows = await query(
    `SELECT v.user_id, v.nickname, v.week_study_minutes, v.week_questions_passed,
            v.week_exp, COALESCE(p.level, 1) AS level
       FROM v_weekly_leaderboard v
       LEFT JOIN user_profiles p ON p.user_id = v.user_id
      ORDER BY v.week_study_minutes DESC, v.week_questions_passed DESC, v.week_exp DESC`,
  );

  const entries = rows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id),
    name: row.nickname,
    initial: String(row.nickname || '蛙').slice(0, 1),
    level: Number(row.level) || 1,
    hours: Number((Number(row.week_study_minutes) / 60).toFixed(1)),
    minutes: Number(row.week_study_minutes),
    passed: Number(row.week_questions_passed),
    isMe: userId ? String(row.user_id) === String(userId) : false,
  }));

  return {
    leaderboard: entries.slice(0, 10),
    currentUserRank: userId ? entries.find((entry) => entry.isMe) || null : null,
    total: entries.length,
  };
}

export async function getDailyQuestion() {
  const rows = await query(
    `SELECT q.question_code
       FROM daily_questions dq
       JOIN questions q ON q.id = dq.question_id AND q.status = 'published'
      WHERE dq.question_date <= CURDATE()
      ORDER BY dq.question_date DESC
      LIMIT 1`,
  );
  const code =
    rows[0]?.question_code ||
    (await query(
      `SELECT question_code FROM questions WHERE status = 'published' ORDER BY id LIMIT 1`,
    ))[0]?.question_code;

  if (!code) throw new ApiError(404, '暂无每日一题');
  return getProblemByCode(code);
}

export async function listKnowledgePoints() {
  return query(
    `SELECT kp.id, kp.name, kp.description, kp.difficulty, kp.sort_order,
            c.course_code, c.title AS course_title
       FROM knowledge_points kp
       LEFT JOIN courses c ON c.id = kp.course_id
      ORDER BY kp.course_id, kp.sort_order`,
  );
}
