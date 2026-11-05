-- ============================================================
-- 奶蛙 Python 学习平台 · 数据库设计脚本
-- 实验五：后端数据库设计（第 15 组）
-- 目标数据库：MySQL 8.0+ / 9.x（已在 MySQL 9.7.0 验证）
--
-- 设计依据：
--   1.《奶蛙 Python 学习平台 PRD》V1.1（第 6、10、11 章）
--   2. 前端项目 003-前端代码（奶蛙 Python 学习平台网页版）
--   3. 实验教程：内容推荐 + 协同过滤 + 自适应学习闭环
--
-- 设计要点：
--   · 账号、课程、学习、判题、激励、消息、报告等平台主业务；
--   · 自适应学习：user_behaviors 记录行为，user_interests 记录兴趣，
--     mastery_scores 记录知识点掌握度（0-1），questions.difficulty
--     记录题目难度（1-5），learning_recommendations 输出个性化推荐；
--   · 内容推荐：course_tags × user_interests 计算标签相似度；
--   · 数据完整性：主外键、唯一约束、CHECK 约束、常用查询索引；
--   · 脚本可重复执行：先 DROP DATABASE 再重建。
-- ============================================================

DROP DATABASE IF EXISTS naiwa_learning;
CREATE DATABASE naiwa_learning
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE naiwa_learning;

SET NAMES utf8mb4;
SET time_zone = '+08:00';

-- ============================================================
-- 一、账号与用户画像
-- ============================================================

-- 1.1 用户表：手机号 / 邮箱注册，密码登录
CREATE TABLE users (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  phone                 VARCHAR(20)     DEFAULT NULL COMMENT '手机号',
  email                 VARCHAR(120)    DEFAULT NULL COMMENT '邮箱',
  password_hash         VARCHAR(255)    NOT NULL COMMENT '密码哈希（bcrypt）',
  nickname              VARCHAR(50)     NOT NULL COMMENT '昵称（2-12字符，唯一）',
  avatar_url            VARCHAR(255)    DEFAULT NULL COMMENT '头像地址',
  role                  ENUM('student','admin') NOT NULL DEFAULT 'student' COMMENT '角色',
  status                ENUM('active','disabled') NOT NULL DEFAULT 'active' COMMENT '账号状态',
  failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续登录失败次数',
  locked_until          DATETIME        DEFAULT NULL COMMENT '账号锁定截止时间',
  last_login_at         DATETIME        DEFAULT NULL COMMENT '最后登录时间',
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_phone (phone),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_nickname (nickname),
  KEY idx_users_status (status),
  CONSTRAINT chk_users_account CHECK (phone IS NOT NULL OR email IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';

-- 1.2 用户档案：新手引导结果、等级/经验、连续打卡、提醒设置
CREATE TABLE user_profiles (
  user_id                          BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  python_base                      ENUM('zero','basic') NOT NULL DEFAULT 'zero' COMMENT 'Python 基础：零基础/学过一点',
  level                            TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '等级 1-5',
  exp                              INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '累计经验值',
  streak_days                      SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当前连续打卡天数',
  longest_streak_days              SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '历史最长连续打卡天数',
  total_study_minutes              INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '累计学习分钟数',
  daily_goal_minutes               SMALLINT UNSIGNED NOT NULL DEFAULT 30 COMMENT '每日学习目标（分钟）',
  bio                              VARCHAR(50)       DEFAULT NULL COMMENT '个人简介（≤50字）',
  onboarding_completed             TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '新手引导是否完成',
  study_reminder_enabled           TINYINT(1)        NOT NULL DEFAULT 1 COMMENT '是否开启学习提醒',
  reminder_time                    TIME              NOT NULL DEFAULT '20:00:00' COMMENT '学习提醒时间',
  achievement_notification_enabled TINYINT(1)        NOT NULL DEFAULT 1 COMMENT '是否开启成就通知',
  code_font_size                   ENUM('12','14','16') NOT NULL DEFAULT '14' COMMENT '编辑器字号',
  default_home                     ENUM('home','courses','profile') NOT NULL DEFAULT 'home' COMMENT '默认首页',
  updated_at                       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_profiles_level CHECK (level BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户档案与设置表';

-- 1.3 用户兴趣：新手引导目标 + 内容推荐标签
CREATE TABLE user_interests (
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  interest   VARCHAR(50)     NOT NULL COMMENT '兴趣标签（办公自动化/数据分析/字符串…）',
  weight     DECIMAL(4,3)    NOT NULL DEFAULT 1.000 COMMENT '兴趣权重 0-1',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (user_id, interest),
  KEY idx_interests_tag (interest),
  CONSTRAINT fk_interests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_interests_weight CHECK (weight BETWEEN 0 AND 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户兴趣标签表（内容推荐数据源）';

-- 1.4 登录会话
CREATE TABLE sessions (
  id          CHAR(36)        NOT NULL COMMENT '会话ID（UUID）',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  token_hash  CHAR(64)        NOT NULL COMMENT '登录令牌哈希（SHA-256）',
  remember_me TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否记住我（7天）',
  ip_address  VARCHAR(45)     DEFAULT NULL COMMENT '客户端IP',
  user_agent  VARCHAR(255)    DEFAULT NULL COMMENT '客户端标识',
  expires_at  DATETIME        NOT NULL COMMENT '过期时间',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='登录会话表';

-- 1.5 验证码（注册 / 找回密码 / 验证码登录）
CREATE TABLE verification_codes (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '验证码ID',
  account      VARCHAR(120)    NOT NULL COMMENT '手机号或邮箱',
  account_type ENUM('phone','email') NOT NULL COMMENT '账号类型',
  purpose      ENUM('register','reset_password','login') NOT NULL COMMENT '用途',
  code_hash    CHAR(64)        NOT NULL COMMENT '验证码哈希',
  expires_at   DATETIME        NOT NULL COMMENT '过期时间（5分钟）',
  used_at      DATETIME        DEFAULT NULL COMMENT '使用时间',
  ip_address   VARCHAR(45)     DEFAULT NULL COMMENT '请求IP',
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_codes_account (account, purpose, created_at),
  KEY idx_codes_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='验证码表';

-- ============================================================
-- 二、课程内容
-- ============================================================

-- 2.1 课程
CREATE TABLE courses (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '课程ID',
  course_code VARCHAR(50)     NOT NULL COMMENT '业务课程编号（如 py-basic-01）',
  title       VARCHAR(100)    NOT NULL COMMENT '课程名称',
  description VARCHAR(255)    DEFAULT NULL COMMENT '一句话简介',
  category    VARCHAR(50)     NOT NULL COMMENT '方向：基础语法/办公自动化/数据分析/趣味编程',
  difficulty  ENUM('beginner','intermediate','challenge') NOT NULL DEFAULT 'beginner' COMMENT '难度：入门/进阶/挑战',
  cover_url   VARCHAR(255)    DEFAULT NULL COMMENT '封面图地址',
  rating      DECIMAL(2,1)    NOT NULL DEFAULT 5.0 COMMENT '评分 0-5',
  is_free     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否免费',
  status      ENUM('draft','published','archived') NOT NULL DEFAULT 'published' COMMENT '状态',
  sort_order  INT             NOT NULL DEFAULT 0 COMMENT '排序',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_courses_code (course_code),
  KEY idx_courses_category (category),
  KEY idx_courses_difficulty (difficulty),
  KEY idx_courses_status (status),
  CONSTRAINT chk_courses_rating CHECK (rating BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='课程表';

-- 2.2 课程标签：内容推荐依据
CREATE TABLE course_tags (
  course_id BIGINT UNSIGNED NOT NULL COMMENT '课程ID',
  tag       VARCHAR(50)     NOT NULL COMMENT '标签（Python/数据分析/pandas…）',
  PRIMARY KEY (course_id, tag),
  KEY idx_course_tags_tag (tag),
  CONSTRAINT fk_course_tags_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='课程标签表（内容推荐数据源）';

-- 2.3 章节
CREATE TABLE chapters (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '章节ID',
  course_id   BIGINT UNSIGNED NOT NULL COMMENT '所属课程ID',
  title       VARCHAR(100)    NOT NULL COMMENT '章节名称',
  description VARCHAR(255)    DEFAULT NULL COMMENT '章节简介',
  sort_order  INT             NOT NULL DEFAULT 0 COMMENT '章节顺序',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_chapters_course (course_id, sort_order),
  CONSTRAINT fk_chapters_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='课程章节表';

-- 2.4 知识点：自适应掌握度的最小单元
CREATE TABLE knowledge_points (
  id          BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT COMMENT '知识点ID',
  course_id   BIGINT UNSIGNED   NOT NULL COMMENT '所属课程ID',
  parent_id   BIGINT UNSIGNED   DEFAULT NULL COMMENT '父知识点ID（支持层级）',
  name        VARCHAR(100)      NOT NULL COMMENT '知识点名称',
  description VARCHAR(255)      DEFAULT NULL COMMENT '知识点说明',
  difficulty  TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '知识点难度 1-5',
  sort_order  INT               NOT NULL DEFAULT 0 COMMENT '排序',
  created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_kp_course_name (course_id, name),
  KEY idx_kp_parent (parent_id),
  CONSTRAINT fk_kp_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_kp_parent FOREIGN KEY (parent_id) REFERENCES knowledge_points (id) ON DELETE SET NULL,
  CONSTRAINT chk_kp_difficulty CHECK (difficulty BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识点表（自适应学习基础）';

-- 2.5 题库：编程练习 / 每日一题，难度 1-5 用于自适应选题
CREATE TABLE questions (
  id           BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT COMMENT '题目ID',
  question_code VARCHAR(50)      NOT NULL COMMENT '题目编号（如 ex-001）',
  title        VARCHAR(100)      NOT NULL COMMENT '题名',
  description  TEXT              NOT NULL COMMENT '题面（Markdown）',
  difficulty   TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '难度 1-5',
  sample_input TEXT              DEFAULT NULL COMMENT '示例输入',
  sample_output TEXT             DEFAULT NULL COMMENT '示例输出',
  initial_code TEXT              DEFAULT NULL COMMENT '初始代码模板',
  hints        JSON              DEFAULT NULL COMMENT '三级提示文案',
  solution     TEXT              DEFAULT NULL COMMENT '官方题解（通过后可见）',
  status       ENUM('draft','published') NOT NULL DEFAULT 'published' COMMENT '状态',
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_questions_code (question_code),
  KEY idx_questions_difficulty (difficulty),
  KEY idx_questions_status (status),
  CONSTRAINT chk_questions_difficulty CHECK (difficulty BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='题库表';

-- 2.6 题目-知识点关联（多对多标签）
CREATE TABLE question_knowledge_points (
  question_id        BIGINT UNSIGNED NOT NULL COMMENT '题目ID',
  knowledge_point_id BIGINT UNSIGNED NOT NULL COMMENT '知识点ID',
  PRIMARY KEY (question_id, knowledge_point_id),
  KEY idx_qkp_kp (knowledge_point_id),
  CONSTRAINT fk_qkp_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT fk_qkp_kp FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='题目-知识点关联表';

-- 2.7 判题测试用例
CREATE TABLE test_cases (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用例ID',
  question_id     BIGINT UNSIGNED NOT NULL COMMENT '题目ID',
  input_text      TEXT            NOT NULL COMMENT '输入数据',
  expected_output TEXT            NOT NULL COMMENT '期望输出',
  is_sample       TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否示例用例',
  sort_order      INT             NOT NULL DEFAULT 0 COMMENT '执行顺序',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_test_cases_question (question_id, sort_order),
  CONSTRAINT fk_test_cases_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='判题测试用例表';

-- 2.8 课时：教程 + 练习，支持顺序解锁与断点续学
CREATE TABLE lessons (
  id               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT COMMENT '课时ID',
  lesson_code      VARCHAR(50)       NOT NULL COMMENT '业务课时编号（如 py-basic-01-c1-l2）',
  chapter_id       BIGINT UNSIGNED   NOT NULL COMMENT '所属章节ID',
  title            VARCHAR(100)      NOT NULL COMMENT '课时名称',
  lesson_type      ENUM('theory','practice') NOT NULL DEFAULT 'theory' COMMENT '类型：纯理论/含练习',
  content          JSON              DEFAULT NULL COMMENT '结构化教程内容（段落/代码块/贴士）',
  initial_code     TEXT              DEFAULT NULL COMMENT '编辑器初始代码模板',
  question_id      BIGINT UNSIGNED   DEFAULT NULL COMMENT '关联练习题目ID',
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 10 COMMENT '预计时长（分钟）',
  difficulty       TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '难度 1-5',
  sort_order       INT               NOT NULL DEFAULT 0 COMMENT '课时顺序',
  is_preview       TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '是否允许试看',
  status           ENUM('draft','published') NOT NULL DEFAULT 'published' COMMENT '状态',
  created_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_lessons_code (lesson_code),
  UNIQUE KEY uk_lessons_question (question_id),
  KEY idx_lessons_chapter (chapter_id, sort_order),
  CONSTRAINT fk_lessons_chapter FOREIGN KEY (chapter_id) REFERENCES chapters (id) ON DELETE CASCADE,
  CONSTRAINT fk_lessons_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE SET NULL,
  CONSTRAINT chk_lessons_difficulty CHECK (difficulty BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='课时表';

-- 2.9 课时-知识点关联
CREATE TABLE lesson_knowledge_points (
  lesson_id          BIGINT UNSIGNED NOT NULL COMMENT '课时ID',
  knowledge_point_id BIGINT UNSIGNED NOT NULL COMMENT '知识点ID',
  weight             DECIMAL(4,2)    NOT NULL DEFAULT 1.00 COMMENT '贡献权重 0-1',
  PRIMARY KEY (lesson_id, knowledge_point_id),
  KEY idx_lkp_kp (knowledge_point_id),
  CONSTRAINT fk_lkp_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_lkp_kp FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points (id) ON DELETE CASCADE,
  CONSTRAINT chk_lkp_weight CHECK (weight BETWEEN 0 AND 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='课时-知识点关联表';

-- ============================================================
-- 三、学习与判题
-- ============================================================

-- 3.1 选课与课程进度
CREATE TABLE course_enrollments (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '选课ID',
  user_id          BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  course_id        BIGINT UNSIGNED NOT NULL COMMENT '课程ID',
  status           ENUM('not_started','learning','completed') NOT NULL DEFAULT 'learning' COMMENT '学习状态',
  progress_percent DECIMAL(5,2)    NOT NULL DEFAULT 0.00 COMMENT '课程进度 0-100',
  last_lesson_id   BIGINT UNSIGNED DEFAULT NULL COMMENT '最近学习课时ID',
  enrolled_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间',
  completed_at     DATETIME        DEFAULT NULL COMMENT '完成时间',
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_enroll_user_course (user_id, course_id),
  KEY idx_enroll_course (course_id),
  KEY idx_enroll_last_lesson (last_lesson_id),
  CONSTRAINT fk_enroll_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_last_lesson FOREIGN KEY (last_lesson_id) REFERENCES lessons (id) ON DELETE SET NULL,
  CONSTRAINT chk_enroll_progress CHECK (progress_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='选课与课程进度表';

-- 3.2 课时学习状态：锁定 / 解锁 / 进行中 / 已完成
CREATE TABLE user_lesson_progress (
  user_id               BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  lesson_id             BIGINT UNSIGNED   NOT NULL COMMENT '课时ID',
  status                ENUM('locked','unlocked','in_progress','completed') NOT NULL DEFAULT 'locked' COMMENT '课时状态',
  progress_percent      DECIMAL(5,2)      NOT NULL DEFAULT 0.00 COMMENT '课时进度 0-100',
  last_position_seconds INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '断点位置（秒）',
  completed_at          DATETIME          DEFAULT NULL COMMENT '完成时间',
  updated_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (user_id, lesson_id),
  KEY idx_ulp_lesson (lesson_id),
  KEY idx_ulp_status (user_id, status),
  CONSTRAINT fk_ulp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ulp_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT chk_ulp_progress CHECK (progress_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户课时进度表';

-- 3.3 学习记录：个人中心时间轴（课时 + 练习统一记录）
CREATE TABLE learning_records (
  id               BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  user_id          BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  record_type      ENUM('lesson','question') NOT NULL COMMENT '记录类型',
  lesson_id        BIGINT UNSIGNED   DEFAULT NULL COMMENT '课时ID（类型为 lesson 时）',
  question_id      BIGINT UNSIGNED   DEFAULT NULL COMMENT '题目ID（类型为 question 时）',
  target_name      VARCHAR(100)      NOT NULL COMMENT '名称快照（便于时间轴展示）',
  result           ENUM('in_progress','completed','passed','failed') NOT NULL DEFAULT 'in_progress' COMMENT '结果',
  duration_seconds INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '本次学习时长（秒）',
  study_date       DATE              NOT NULL COMMENT '学习日期',
  created_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_lr_user_time (user_id, created_at),
  KEY idx_lr_user_date (user_id, study_date),
  KEY idx_lr_lesson (lesson_id),
  KEY idx_lr_question (question_id),
  CONSTRAINT fk_lr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT chk_lr_target CHECK (
    (record_type = 'lesson'   AND lesson_id IS NOT NULL AND question_id IS NULL) OR
    (record_type = 'question' AND question_id IS NOT NULL AND lesson_id IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学习记录表';

-- 3.4 代码草稿：课时 / 练习共用，登录用户云端保存
CREATE TABLE code_drafts (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '草稿ID',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  target_type ENUM('lesson','question') NOT NULL COMMENT '草稿对象类型',
  target_id   BIGINT UNSIGNED NOT NULL COMMENT '课时ID或题目ID',
  code        LONGTEXT        NOT NULL COMMENT '代码内容',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_drafts_target (user_id, target_type, target_id),
  KEY idx_drafts_target (target_type, target_id),
  CONSTRAINT fk_drafts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='代码草稿表（多态关联）';

-- 3.5 判题提交记录：一次答题 = 一条提交
CREATE TABLE submissions (
  id                   BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT COMMENT '提交ID',
  user_id              BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  question_id          BIGINT UNSIGNED   NOT NULL COMMENT '题目ID',
  code                 LONGTEXT          NOT NULL COMMENT '提交代码',
  result               ENUM('accepted','partial','failed','timeout','error') NOT NULL COMMENT '判题结果',
  passed_cases         SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '通过用例数',
  total_cases          SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总用例数',
  failed_case          JSON              DEFAULT NULL COMMENT '首个失败用例（输入/期望/实际）',
  runtime_ms           INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '运行耗时（毫秒）',
  hint_level_used      TINYINT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '使用提示等级 0-3',
  attempt_no           SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '本题第几次提交',
  is_first_attempt_pass TINYINT(1)       NOT NULL DEFAULT 0 COMMENT '是否首次提交即通过',
  submitted_at         DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  PRIMARY KEY (id),
  KEY idx_sub_user_time (user_id, submitted_at),
  KEY idx_sub_question_result (question_id, result),
  KEY idx_sub_question_time (question_id, submitted_at),
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT chk_sub_cases CHECK (passed_cases <= total_cases),
  CONSTRAINT chk_sub_hint CHECK (hint_level_used BETWEEN 0 AND 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='判题提交记录表';

-- ============================================================
-- 四、自适应学习（教程核心）
-- ============================================================

-- 4.1 知识点掌握度：0-1 分值，答对加分、答错减分
CREATE TABLE mastery_scores (
  user_id            BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  knowledge_point_id BIGINT UNSIGNED NOT NULL COMMENT '知识点ID',
  score              DECIMAL(4,3)    NOT NULL DEFAULT 0.000 COMMENT '掌握度 0-1',
  attempts           INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '累计练习次数',
  correct_count      INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '累计答对次数',
  last_practiced_at  DATETIME        DEFAULT NULL COMMENT '最近练习时间',
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (user_id, knowledge_point_id),
  KEY idx_mastery_kp (knowledge_point_id),
  KEY idx_mastery_score (score),
  CONSTRAINT fk_mastery_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_mastery_kp FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points (id) ON DELETE CASCADE,
  CONSTRAINT chk_mastery_score CHECK (score BETWEEN 0 AND 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识点掌握度表（0-1）';

-- 4.2 用户行为埋点：浏览 / 学习 / 运行 / 提交 / 判题 / 打卡…
CREATE TABLE user_behaviors (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '行为ID',
  user_id       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  behavior_type ENUM('page_view','course_view','lesson_start','lesson_complete',
                     'code_run','code_submit','judge_result','search',
                     'daily_checkin','achievement_unlock') NOT NULL COMMENT '行为类型',
  target_type   ENUM('course','chapter','lesson','question','page','none') NOT NULL DEFAULT 'none' COMMENT '对象类型',
  target_id     BIGINT UNSIGNED DEFAULT NULL COMMENT '对象ID',
  extra         JSON            DEFAULT NULL COMMENT '扩展参数（结果/耗时/关键词等）',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  PRIMARY KEY (id),
  KEY idx_behavior_user_time (user_id, created_at),
  KEY idx_behavior_type_time (behavior_type, created_at),
  KEY idx_behavior_target (target_type, target_id),
  CONSTRAINT fk_behavior_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户行为埋点表（协同过滤数据源）';

-- 4.3 个性化推荐：内容推荐 + 自适应下一题
CREATE TABLE learning_recommendations (
  id                 BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '推荐ID',
  user_id            BIGINT UNSIGNED  NOT NULL COMMENT '用户ID',
  rec_type           ENUM('course','lesson','question','review') NOT NULL DEFAULT 'question' COMMENT '推荐类型',
  course_id          BIGINT UNSIGNED  DEFAULT NULL COMMENT '推荐课程ID',
  lesson_id          BIGINT UNSIGNED  DEFAULT NULL COMMENT '推荐课时ID',
  question_id        BIGINT UNSIGNED  DEFAULT NULL COMMENT '推荐题目ID',
  knowledge_point_id BIGINT UNSIGNED  DEFAULT NULL COMMENT '关联知识点ID',
  reason             VARCHAR(255)     NOT NULL COMMENT '推荐理由',
  priority           TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '优先级（1 最高）',
  status             ENUM('pending','viewed','completed','expired') NOT NULL DEFAULT 'pending' COMMENT '状态',
  expires_at         DATETIME         DEFAULT NULL COMMENT '过期时间',
  created_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_rec_user_status (user_id, status, priority),
  KEY idx_rec_course (course_id),
  KEY idx_rec_lesson (lesson_id),
  KEY idx_rec_question (question_id),
  KEY idx_rec_kp (knowledge_point_id),
  CONSTRAINT fk_rec_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_lesson FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_kp FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points (id) ON DELETE CASCADE,
  CONSTRAINT chk_rec_target CHECK (
    course_id IS NOT NULL OR lesson_id IS NOT NULL OR
    question_id IS NOT NULL OR knowledge_point_id IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='个性化推荐表';

-- 4.4 每日一题
CREATE TABLE daily_questions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '每日一题ID',
  question_date DATE            NOT NULL COMMENT '日期',
  question_id   BIGINT UNSIGNED NOT NULL COMMENT '题目ID',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_daily_date (question_date),
  KEY idx_daily_question (question_id),
  CONSTRAINT fk_daily_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每日一题表';

-- ============================================================
-- 五、报告、激励与消息
-- ============================================================

-- 5.1 学习报告：周报 / 月报，含薄弱知识点快照
CREATE TABLE reports (
  id                 BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT COMMENT '报告ID',
  user_id            BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  period_type        ENUM('weekly','monthly') NOT NULL DEFAULT 'weekly' COMMENT '报告周期',
  period_start       DATE              NOT NULL COMMENT '统计开始日期',
  period_end         DATE              NOT NULL COMMENT '统计结束日期',
  study_minutes      INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '学习时长（分钟）',
  lessons_completed  SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '完成课时数',
  questions_attempted SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '答题数',
  questions_passed   SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '通过题数',
  accuracy_percent   DECIMAL(5,2)      NOT NULL DEFAULT 0.00 COMMENT '正确率 0-100',
  streak_days        SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '连续打卡天数',
  weak_points        JSON              DEFAULT NULL COMMENT '薄弱知识点快照',
  summary            TEXT              DEFAULT NULL COMMENT '学习总结',
  generated_at       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_reports_user_period (user_id, period_type, period_start),
  KEY idx_reports_period (period_start, period_end),
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_reports_accuracy CHECK (accuracy_percent BETWEEN 0 AND 100),
  CONSTRAINT chk_reports_period CHECK (period_end >= period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学习报告表';

-- 5.2 报告分享令牌
CREATE TABLE share_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分享ID',
  report_id  BIGINT UNSIGNED NOT NULL COMMENT '报告ID',
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  token      CHAR(32)        NOT NULL COMMENT '分享令牌',
  expires_at DATETIME        DEFAULT NULL COMMENT '过期时间',
  view_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '访问次数',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_share_token (token),
  KEY idx_share_report (report_id),
  KEY idx_share_user (user_id),
  CONSTRAINT fk_share_report FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE,
  CONSTRAINT fk_share_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学习报告分享令牌表';

-- 5.3 收藏：课程 / 课时 / 题目
CREATE TABLE favorites (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收藏ID',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  target_type ENUM('course','lesson','question') NOT NULL COMMENT '收藏对象类型',
  target_id   BIGINT UNSIGNED NOT NULL COMMENT '收藏对象ID',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_fav (user_id, target_type, target_id),
  KEY idx_fav_target (target_type, target_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='收藏表（多态关联）';

-- 5.4 成就定义
CREATE TABLE achievements (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '成就ID',
  code           VARCHAR(50)     NOT NULL COMMENT '成就编码',
  name           VARCHAR(50)     NOT NULL COMMENT '成就名称',
  description    VARCHAR(255)    DEFAULT NULL COMMENT '成就说明',
  icon_url       VARCHAR(255)    DEFAULT NULL COMMENT '图标地址',
  condition_desc VARCHAR(255)    NOT NULL COMMENT '解锁条件',
  sort_order     INT             NOT NULL DEFAULT 0 COMMENT '排序',
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_ach_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='成就定义表';

-- 5.5 用户成就
CREATE TABLE user_achievements (
  user_id        BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  achievement_id BIGINT UNSIGNED NOT NULL COMMENT '成就ID',
  unlocked_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '解锁时间',
  PRIMARY KEY (user_id, achievement_id),
  KEY idx_ua_achievement (achievement_id),
  CONSTRAINT fk_ua_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ua_achievement FOREIGN KEY (achievement_id) REFERENCES achievements (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户成就表';

-- 5.6 消息中心
CREATE TABLE messages (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '接收用户ID',
  title        VARCHAR(100)    NOT NULL COMMENT '消息标题',
  content      TEXT            NOT NULL COMMENT '消息内容',
  message_type ENUM('system','achievement','reminder') NOT NULL DEFAULT 'system' COMMENT '消息类型',
  action_type  ENUM('none','achievement','lesson','question','page') NOT NULL DEFAULT 'none' COMMENT '点击跳转类型',
  action_id    BIGINT UNSIGNED DEFAULT NULL COMMENT '跳转对象ID',
  is_read      TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否已读',
  read_at      DATETIME        DEFAULT NULL COMMENT '阅读时间',
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_msg_user_read (user_id, is_read, created_at),
  CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消息中心表';

-- 5.7 用户每日学习统计：连续打卡、排行榜、报告的数据来源
CREATE TABLE user_daily_stats (
  user_id             BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  stat_date           DATE              NOT NULL COMMENT '统计日期',
  study_minutes       SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '学习分钟数',
  lessons_completed   SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '完成课时数',
  questions_attempted SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '答题数',
  questions_passed    SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '通过题数',
  exp_earned          SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当日获得经验值',
  streak_days         SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '截至当天连续学习天数',
  updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (user_id, stat_date),
  KEY idx_stats_date_minutes (stat_date, study_minutes),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户每日学习统计表';

-- ============================================================
-- 六、视图：课程概览、学习概览、排行榜、题目状态、掌握度
-- ============================================================

-- 6.1 课程概览：课时数、总时长、学习人数
CREATE OR REPLACE VIEW v_course_overview AS
SELECT
  c.id,
  c.course_code,
  c.title,
  c.category,
  c.difficulty,
  c.cover_url,
  c.rating,
  (SELECT COUNT(*) FROM course_enrollments e WHERE e.course_id = c.id) AS learner_count,
  (SELECT COUNT(*)
     FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
    WHERE ch.course_id = c.id) AS lesson_count,
  (SELECT COALESCE(SUM(l.duration_minutes), 0)
     FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
    WHERE ch.course_id = c.id) AS total_duration_minutes
FROM courses c
WHERE c.status = 'published';

-- 6.2 用户学习概览
CREATE OR REPLACE VIEW v_user_learning_summary AS
SELECT
  u.id AS user_id,
  u.nickname,
  p.level,
  p.exp,
  p.streak_days,
  (SELECT COUNT(*) FROM course_enrollments e
    WHERE e.user_id = u.id AND e.status = 'completed') AS completed_courses,
  (SELECT COUNT(*) FROM user_lesson_progress lp
    WHERE lp.user_id = u.id AND lp.status = 'completed') AS completed_lessons,
  (SELECT COUNT(DISTINCT s.question_id) FROM submissions s
    WHERE s.user_id = u.id AND s.result = 'accepted') AS passed_questions,
  (SELECT COALESCE(SUM(s.study_minutes), 0)
     FROM user_daily_stats s WHERE s.user_id = u.id) AS study_minutes
FROM users u
JOIN user_profiles p ON p.user_id = u.id;

-- 6.3 周学习排行榜：近 7 天学习时长 TOP
CREATE OR REPLACE VIEW v_weekly_leaderboard AS
SELECT
  u.id AS user_id,
  u.nickname,
  SUM(s.study_minutes)       AS week_study_minutes,
  SUM(s.questions_passed)    AS week_questions_passed,
  SUM(s.exp_earned)          AS week_exp
FROM user_daily_stats s
JOIN users u ON u.id = s.user_id
WHERE s.stat_date >= CURDATE() - INTERVAL 6 DAY
GROUP BY u.id, u.nickname
ORDER BY week_study_minutes DESC, week_questions_passed DESC;

-- 6.4 用户题目状态：未做 / 未通过 / 已通过 + 星级
CREATE OR REPLACE VIEW v_user_question_status AS
SELECT
  u.id AS user_id,
  q.id AS question_id,
  q.question_code,
  q.title,
  q.difficulty,
  COUNT(s.id) AS attempt_count,
  COALESCE(SUM(s.result = 'accepted'), 0) AS accepted_count,
  MAX(s.submitted_at) AS last_submitted_at,
  CASE
    WHEN COALESCE(SUM(s.result = 'accepted'), 0) > 0 THEN 'passed'
    WHEN COUNT(s.id) > 0 THEN 'failed'
    ELSE 'todo'
  END AS status,
  CASE
    WHEN COALESCE(SUM(s.result = 'accepted'), 0) = 0 THEN 0
    WHEN MAX(CASE WHEN s.result = 'accepted' THEN s.is_first_attempt_pass ELSE 0 END) = 1
         AND MAX(CASE WHEN s.result = 'accepted' THEN s.hint_level_used ELSE 0 END) = 0 THEN 3
    WHEN MAX(CASE WHEN s.result = 'accepted' THEN s.hint_level_used ELSE 0 END) = 0 THEN 2
    ELSE 1
  END AS stars
FROM users u
CROSS JOIN questions q
LEFT JOIN submissions s ON s.user_id = u.id AND s.question_id = q.id
WHERE q.status = 'published'
GROUP BY u.id, q.id, q.question_code, q.title, q.difficulty;

-- 6.5 掌握度与目标难度：目标难度 = 掌握度映射(1-5) + 一步 η
CREATE OR REPLACE VIEW v_mastery_target AS
SELECT
  m.user_id,
  m.knowledge_point_id,
  kp.name AS knowledge_point_name,
  m.score,
  m.attempts,
  m.correct_count,
  LEAST(5, GREATEST(1, ROUND(m.score * 4 + 1))) AS base_difficulty,
  LEAST(5, GREATEST(1, ROUND(m.score * 4 + 1) + 1)) AS target_difficulty
FROM mastery_scores m
JOIN knowledge_points kp ON kp.id = m.knowledge_point_id;

-- ============================================================
-- 七、演示数据
-- ============================================================

-- 7.1 用户与档案
INSERT INTO users (id, phone, email, password_hash, nickname, role, last_login_at, created_at) VALUES
  (1, '13800001111', 'xiaolin@example.com', '$2b$12$DEMO_HASH_XIAOLIN_1234567890', '小林同学', 'student', '2026-11-05 08:50:00', '2026-10-04 10:00:00'),
  (2, '13900002222', 'zhangjie@example.com', '$2b$12$DEMO_HASH_ZHANGJIE_123456789', '张姐',    'student', '2026-11-05 09:10:00', '2026-10-20 14:30:00');

INSERT INTO user_profiles
  (user_id, python_base, level, exp, streak_days, longest_streak_days, total_study_minutes,
   daily_goal_minutes, bio, onboarding_completed, reminder_time, code_font_size, default_home) VALUES
  (1, 'zero',  2, 240, 7, 7, 1110, 45, '正在学习 Python 的零基础同学', 1, '20:00:00', '14', 'home'),
  (2, 'basic', 2, 220, 3, 5,  320, 30, '想用 Python 提升办公效率',     1, '19:30:00', '16', 'courses');

INSERT INTO user_interests (user_id, interest, weight) VALUES
  (1, '数据分析', 1.000),
  (1, 'Python基础', 0.900),
  (1, '字符串', 0.800),
  (1, '变量', 0.700),
  (2, '办公自动化', 1.000),
  (2, 'Excel', 0.900);

INSERT INTO sessions (id, user_id, token_hash, remember_me, ip_address, user_agent, expires_at) VALUES
  ('9f1c2e3d-4b5a-6c7d-8e9f-0a1b2c3d4e5f', 1, REPEAT('a', 64), 1, '127.0.0.1', 'Mozilla/5.0 Demo', '2026-11-12 08:50:00');

-- 7.2 课程与标签
INSERT INTO courses (id, course_code, title, description, category, difficulty, rating, is_free, status, sort_order) VALUES
  (1, 'py-basic-01',      'Python 零基础入门', '从 print 开始，学会写你的第一个程序', '基础语法',   'beginner',     4.9, 1, 'published', 1),
  (2, 'excel-auto-01',    'Excel 自动化',      '用 Python 批量处理表格，告别重复劳动', '办公自动化', 'intermediate', 4.8, 1, 'published', 2),
  (3, 'data-analysis-01', '数据分析入门',      '用 pandas 完成数据清洗与可视化',       '数据分析',   'intermediate', 4.8, 1, 'published', 3),
  (4, 'game-dev-01',      '小游戏开发',        '用 Python 写出你的第一个小游戏',       '趣味编程',   'challenge',    4.7, 1, 'published', 4);

INSERT INTO course_tags (course_id, tag) VALUES
  (1, 'Python'), (1, '基础语法'), (1, '变量'), (1, '字符串'), (1, '循环'), (1, '函数'),
  (2, 'Excel'), (2, '办公自动化'), (2, '文件处理'),
  (3, 'Python'), (3, '数据分析'), (3, 'pandas'), (3, '可视化'),
  (4, 'Python'), (4, '游戏开发'), (4, '趣味编程');

-- 7.3 章节、知识点、题目、用例、课时
INSERT INTO chapters (id, course_id, title, sort_order) VALUES
  (1, 1, '第 1 章 和 Python 打个招呼', 1),
  (2, 1, '第 2 章 变量与数据类型',     2),
  (3, 1, '第 3 章 条件判断与循环',     3),
  (4, 2, '第 1 章 Excel 自动化起步',   1),
  (5, 3, '第 1 章 数据分析起步',       1),
  (6, 4, '第 1 章 小游戏开发起步',     1);

INSERT INTO knowledge_points (id, course_id, parent_id, name, description, difficulty, sort_order) VALUES
  (1,  1, NULL, 'print 与输入', 'print 输出与 input 输入', 1, 1),
  (2,  1, NULL, '变量',         '变量命名、赋值与类型',    1, 2),
  (3,  1, NULL, '字符串',       '字符串定义与拼接',        2, 3),
  (4,  1, NULL, '数字与运算',   '整数、浮点数与运算符',    2, 4),
  (5,  1, NULL, '条件判断',     'if / elif / else',        2, 5),
  (6,  1, NULL, '循环',         'for 与 while 循环',       3, 6),
  (7,  1, NULL, '列表',         '列表的增删改查',          3, 7),
  (8,  1, NULL, '字典',         '字典的键值对操作',        3, 8),
  (9,  1, NULL, '函数',         '函数定义、参数与返回值',  4, 9),
  (10, 2, NULL, 'Excel 文件读写', 'openpyxl 读取与写入',   2, 10),
  (11, 3, NULL, 'pandas 数据处理', 'DataFrame 读取与清洗',  3, 11),
  (12, 4, NULL, '游戏循环',        '事件循环与帧刷新',     4, 12);

INSERT INTO questions
  (id, question_code, title, description, difficulty, sample_input, sample_output, initial_code, hints, solution) VALUES
  (1, 'ex-001', '贝莉的问候语',
   '读取用户输入的名字，输出一句问候：`你好, 名字`。',
   1, '小蛙', '你好, 小蛙',
   'name = input()\n# 在这里写下你的代码\n',
   '["先想想怎么用 print 输出文字。","字符串可以用 + 号拼接。","print(''你好, '' + name)"]',
   'name = input()\nprint("你好, " + name)'),
  (2, 'ex-002', '计算平均分',
   '给出一组分数，计算并返回平均分，结果保留 1 位小数。',
   2, '[80, 90, 100]', '90.0',
   'def average(scores):\n    # 在这里计算平均分\n    pass\n',
   '["平均分 = 总和 ÷ 个数。","可以用 sum() 求总和，len() 求个数。","return round(sum(scores) / len(scores), 1)"]',
   'def average(scores):\n    return round(sum(scores) / len(scores), 1)'),
  (3, 'ex-003', '猜数字小游戏',
   '第一行是目标数字，之后每行是一次猜测，输出猜中时一共猜了几次。',
   3, '42\n25\n50\n42', '3',
   'target = int(input())\ncount = 0\n# 循环读取猜测并计数\n',
   '["用 while True 循环读取。","每读入一个猜测就让 count 加 1。","猜中时 break，最后 print(count)"]',
   'target = int(input())\ncount = 0\nwhile True:\n    guess = int(input())\n    count += 1\n    if guess == target:\n        break\nprint(count)'),
  (4, 'ex-004', '打印你的名字',
   '读取名字并用 print 输出 `你好, 名字`。',
   1, '小林', '你好, 小林',
   'name = input()\n# 打印问候\n',
   '["print 可以输出文字。","把 input 读到的名字拼进去。","print(''你好, '' + name)"]',
   'name = input()\nprint("你好, " + name)'),
  (5, 'ex-005', '列表去重',
   '给出一组数字，输出去重后的列表（保持原顺序）。',
   3, '[1, 2, 2, 3]', '[1, 2, 3]',
   'def unique(items):\n    # 在这里去重\n    pass\n',
   '["可以新建一个结果列表。","遍历时判断元素是否已经在结果里。","if x not in result: result.append(x)"]',
   'def unique(items):\n    result = []\n    for x in items:\n        if x not in result:\n            result.append(x)\n    return result');

INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES
  (1, 3), (2, 4), (3, 5), (3, 6), (4, 1), (4, 2), (5, 7);

INSERT INTO test_cases (question_id, input_text, expected_output, is_sample, sort_order) VALUES
  (1, '小蛙', '你好, 小蛙', 1, 1),
  (1, '奶蛙', '你好, 奶蛙', 0, 2),
  (2, '[80, 90, 100]', '90.0', 1, 1),
  (2, '[100]', '100.0', 0, 2),
  (3, '42\n25\n50\n42', '3', 1, 1),
  (3, '10\n20\n5\n10', '3', 0, 2),
  (4, '小林', '你好, 小林', 1, 1),
  (4, '奶蛙', '你好, 奶蛙', 0, 2),
  (5, '[1, 2, 2, 3]', '[1, 2, 3]', 1, 1),
  (5, '[5, 5, 5]', '[5]', 0, 2);

INSERT INTO lessons
  (id, lesson_code, chapter_id, title, lesson_type, content, initial_code, question_id, duration_minutes, difficulty, sort_order, is_preview) VALUES
  (1, 'py-basic-01-c1-l1', 1, '1.1 安装？不用！浏览器就能写', 'theory',
   '[{"type":"paragraph","text":"奶蛙平台已经内置了 Python 运行环境，打开浏览器就能写代码。"},{"type":"code","language":"python","code":"print(''你好，奶蛙'')"}]',
   NULL, NULL, 10, 1, 1, 1),
  (2, 'py-basic-01-c1-l2', 1, '1.2 第一行 print 代码', 'practice',
   '[{"type":"paragraph","text":"print 是 Python 最常用的输出函数。"},{"type":"code","language":"python","code":"print(''Hello, World!'')"}]',
   'name = input()\n# 打印问候\n', 4, 12, 1, 2, 0),
  (3, 'py-basic-01-c2-l1', 2, '2.1 什么是变量', 'theory',
   '[{"type":"paragraph","text":"变量就像一个贴了名字的盒子，用来保存数据。"},{"type":"code","language":"python","code":"name = ''奶蛙''\\nprint(name)"}]',
   NULL, NULL, 10, 1, 1, 0),
  (4, 'py-basic-01-c2-l2', 2, '2.2 用字符串拼接出一句问候', 'practice',
   '[{"type":"paragraph","text":"用 + 号可以把两个字符串拼在一起。"},{"type":"code","language":"python","code":"name = ''奶蛙''\\nprint(''你好, '' + name)"}]',
   'name = input()\n# 在这里写下你的代码\n', 1, 15, 2, 2, 0),
  (5, 'py-basic-01-c3-l1', 3, '3.1 条件判断 if / else', 'theory',
   '[{"type":"paragraph","text":"条件判断让程序可以根据情况做出不同选择。"},{"type":"code","language":"python","code":"score = 90\\nif score >= 60:\\n    print(''通过'')"}]',
   NULL, NULL, 12, 2, 1, 0),
  (6, 'py-basic-01-c3-l2', 3, '3.2 章节练习：猜数字', 'practice',
   '[{"type":"paragraph","text":"综合运用条件判断和循环，完成猜数字小游戏。"}]',
   'target = int(input())\ncount = 0\n# 循环读取猜测并计数\n', 3, 20, 3, 2, 0),
  (7, 'excel-auto-01-c1-l1', 4, '1.1 用 Python 读取 Excel', 'theory',
   '[{"type":"paragraph","text":"使用 openpyxl 读取工作簿中的单元格数据。"}]',
   NULL, NULL, 15, 2, 1, 1),
  (8, 'data-analysis-01-c1-l1', 5, '1.1 pandas 读取 CSV', 'theory',
   '[{"type":"paragraph","text":"pandas 可以一行代码读取 CSV 文件。"},{"type":"code","language":"python","code":"import pandas as pd\\ndf = pd.read_csv(''data.csv'')"}]',
   NULL, NULL, 20, 3, 1, 1),
  (9, 'game-dev-01-c1-l1', 6, '1.1 游戏主循环', 'theory',
   '[{"type":"paragraph","text":"游戏主循环负责不断处理事件、更新画面。"}]',
   NULL, NULL, 20, 4, 1, 1);

INSERT INTO lesson_knowledge_points (lesson_id, knowledge_point_id, weight) VALUES
  (1, 1, 1.00), (2, 1, 1.00), (3, 2, 1.00), (4, 3, 1.00),
  (5, 5, 1.00), (6, 5, 0.70), (6, 6, 0.70),
  (7, 10, 1.00), (8, 11, 1.00), (9, 12, 1.00);

-- 7.4 选课、课时进度、学习记录、草稿
INSERT INTO course_enrollments
  (id, user_id, course_id, status, progress_percent, last_lesson_id, enrolled_at, updated_at) VALUES
  (1, 1, 1, 'learning', 56.67, 4, '2026-10-29 19:00:00', '2026-11-04 21:00:00'),
  (2, 1, 3, 'learning', 10.00, 8, '2026-11-01 20:00:00', '2026-11-01 20:20:00'),
  (3, 2, 2, 'learning', 20.00, 7, '2026-11-01 19:30:00', '2026-11-04 19:50:00');

INSERT INTO user_lesson_progress
  (user_id, lesson_id, status, progress_percent, last_position_seconds, completed_at) VALUES
  (1, 1, 'completed',   100.00, 600,  '2026-10-29 19:20:00'),
  (1, 2, 'completed',   100.00, 720,  '2026-10-31 20:30:00'),
  (1, 3, 'completed',   100.00, 600,  '2026-11-02 20:00:00'),
  (1, 4, 'in_progress',  40.00, 300,  NULL),
  (1, 5, 'unlocked',      0.00,   0,  NULL),
  (1, 6, 'locked',        0.00,   0,  NULL),
  (2, 7, 'in_progress',  20.00, 180,  NULL);

INSERT INTO learning_records
  (user_id, record_type, lesson_id, question_id, target_name, result, duration_seconds, study_date, created_at) VALUES
  (1, 'lesson',   1, NULL, '1.1 安装？不用！浏览器就能写', 'completed',   600, '2026-10-29', '2026-10-29 19:20:00'),
  (1, 'lesson',   2, NULL, '1.2 第一行 print 代码',        'completed',   720, '2026-10-31', '2026-10-31 20:30:00'),
  (1, 'lesson',   3, NULL, '2.1 什么是变量',               'completed',   600, '2026-11-02', '2026-11-02 20:00:00'),
  (1, 'lesson',   4, NULL, '2.2 用字符串拼接出一句问候',   'in_progress', 480, '2026-11-04', '2026-11-04 21:00:00'),
  (1, 'question', NULL, 4, 'ex-004 打印你的名字',          'passed',        0, '2026-10-31', '2026-10-31 20:15:00'),
  (1, 'question', NULL, 1, 'ex-001 贝莉的问候语',          'passed',        0, '2026-11-02', '2026-11-02 20:15:00'),
  (1, 'question', NULL, 3, 'ex-003 猜数字小游戏',          'failed',        0, '2026-11-04', '2026-11-04 21:05:00');

INSERT INTO code_drafts (user_id, target_type, target_id, code) VALUES
  (1, 'lesson',   4, 'name = input()\n# 在这里写下你的代码\nprint("你好, " + name)\n'),
  (1, 'question', 3, 'target = int(input())\ncount = 0\n# 循环读取猜测并计数\n');

-- 7.5 判题提交
INSERT INTO submissions
  (user_id, question_id, code, result, passed_cases, total_cases, failed_case, runtime_ms,
   hint_level_used, attempt_no, is_first_attempt_pass, submitted_at) VALUES
  (1, 4, 'name = input()\nprint("你好, " + name)', 'accepted', 2, 2, NULL, 30, 0, 1, 1, '2026-10-31 20:15:00'),
  (1, 1, 'name = input()\nprint("你好, " + name)', 'partial', 1, 2,
   '{"input":"小蛙","expected":"你好, 小蛙","actual":"你好,小蛙"}', 25, 0, 1, 0, '2026-11-02 20:10:00'),
  (1, 1, 'name = input()\nprint("你好, " + name)', 'accepted', 2, 2, NULL, 28, 1, 2, 0, '2026-11-02 20:15:00'),
  (1, 3, 'target = int(input())\ncount = 0\nwhile True:\n    guess = int(input())\n    count += 1', 'failed', 0, 2,
   '{"input":"42\\n25\\n50\\n42","expected":"3","actual":"程序超时"}', 5000, 0, 1, 0, '2026-11-04 21:00:00'),
  (1, 3, 'target = int(input())\ncount = 0\nwhile True:\n    guess = int(input())\n    count += 1\n    if guess == target:\n        break\nprint(count)', 'partial', 1, 2,
   '{"input":"10\\n20\\n5\\n10","expected":"3","actual":"4"}', 20, 0, 2, 0, '2026-11-04 21:05:00');

-- 7.6 自适应学习数据
INSERT INTO mastery_scores
  (user_id, knowledge_point_id, score, attempts, correct_count, last_practiced_at) VALUES
  (1, 1, 0.900, 2, 2, '2026-10-31 20:15:00'),
  (1, 2, 0.700, 1, 1, '2026-10-31 20:15:00'),
  (1, 3, 0.650, 2, 1, '2026-11-02 20:15:00'),
  (1, 4, 0.450, 0, 0, NULL),
  (1, 5, 0.400, 2, 0, '2026-11-04 21:05:00'),
  (1, 6, 0.300, 2, 0, '2026-11-04 21:05:00'),
  (1, 7, 0.200, 0, 0, NULL),
  (1, 8, 0.100, 0, 0, NULL),
  (1, 9, 0.000, 0, 0, NULL),
  (2, 10, 0.500, 0, 0, NULL);

INSERT INTO user_behaviors (user_id, behavior_type, target_type, target_id, extra, created_at) VALUES
  (1, 'page_view',         'page',     1, '{"page_id":"PG-01"}', '2026-10-29 19:00:00'),
  (1, 'course_view',       'course',   1, '{"difficulty":"beginner"}', '2026-10-29 19:05:00'),
  (1, 'lesson_start',      'lesson',   1, '{"source":"course_detail"}', '2026-10-29 19:10:00'),
  (1, 'lesson_complete',   'lesson',   1, '{"duration":600}', '2026-10-29 19:20:00'),
  (1, 'code_submit',       'question', 4, '{"attempt":1}', '2026-10-31 20:15:00'),
  (1, 'judge_result',      'question', 4, '{"result":"accepted","passed":2,"total":2,"runtime":30}', '2026-10-31 20:15:01'),
  (1, 'lesson_complete',   'lesson',   2, '{"duration":720}', '2026-10-31 20:30:00'),
  (1, 'search',            'none',     NULL, '{"keyword":"字符串","result_count":3}', '2026-10-31 21:00:00'),
  (1, 'code_submit',       'question', 1, '{"attempt":2}', '2026-11-02 20:15:00'),
  (1, 'judge_result',      'question', 1, '{"result":"accepted","passed":2,"total":2,"runtime":28}', '2026-11-02 20:15:01'),
  (1, 'code_submit',       'question', 3, '{"attempt":2}', '2026-11-04 21:05:00'),
  (1, 'judge_result',      'question', 3, '{"result":"partial","passed":1,"total":2}', '2026-11-04 21:05:01'),
  (1, 'daily_checkin',     'none',     NULL, '{"streak_days":7}', '2026-11-04 21:10:00'),
  (1, 'achievement_unlock','none',     NULL, '{"achievement":"streak_7"}', '2026-11-04 21:10:00');

INSERT INTO learning_recommendations
  (user_id, rec_type, course_id, lesson_id, question_id, knowledge_point_id, reason, priority, status) VALUES
  (1, 'review',   NULL, NULL, 3, 5, '条件判断掌握度 0.40，建议复习并重做猜数字练习', 1, 'pending'),
  (1, 'question', NULL, NULL, 2, 4, '数字与运算掌握度 0.45，推荐难度 2 的基础练习', 2, 'pending'),
  (1, 'course',   3,    NULL, NULL, 11, '兴趣标签命中「数据分析」，推荐数据分析入门', 2, 'pending'),
  (1, 'lesson',   NULL, 5, NULL, 5, '已解锁条件判断课时，建议先完成学习', 3, 'pending'),
  (1, 'review',   NULL, 6, 3, 6, '循环掌握度 0.30，建议回补 while 循环', 1, 'pending');

INSERT INTO daily_questions (question_date, question_id) VALUES
  (DATE_SUB(CURDATE(), INTERVAL 1 DAY), 4),
  (CURDATE(), 5);

-- 7.7 报告、收藏、成就、消息、每日统计
INSERT INTO reports
  (user_id, period_type, period_start, period_end, study_minutes, lessons_completed,
   questions_attempted, questions_passed, accuracy_percent, streak_days, weak_points, summary) VALUES
  (1, 'weekly', '2026-10-29', '2026-11-04', 98, 3, 3, 2, 66.67, 7,
   '[{"knowledge_point_id":5,"name":"条件判断","score":0.4},{"knowledge_point_id":6,"name":"循环","score":0.3}]',
   '本周完成 3 个课时、通过 2 道练习，建议加强条件判断与循环。');

INSERT INTO share_tokens (report_id, user_id, token, expires_at, view_count) VALUES
  (1, 1, '7f3a9c2e5b1d4f6a8c0e2b4d6f8a1c3e', '2026-12-31 23:59:59', 12);

INSERT INTO favorites (user_id, target_type, target_id) VALUES
  (1, 'course', 1),
  (1, 'question', 2);

INSERT INTO achievements (code, name, description, icon_url, condition_desc, sort_order) VALUES
  ('first_line',    '第一行代码', '完成第一个课时',           'assets/achv-first.png',    '完成第一个课时', 1),
  ('ten_lessons',   '初出茅庐',   '累计完成 10 个课时',       'assets/achv-ten.png',      '累计完成 10 个课时', 2),
  ('chapter_clear', '章节通关',   '完成任意 1 个章节',        'assets/achv-chapter.png',  '完成任意章节全部课时', 3),
  ('practice_50',   '练习达人',   '累计通过 50 道练习',       'assets/achv-practice.png', '累计通过 50 道练习', 4),
  ('first_try',     '一次就对',   '单题一次通过且未用提示',   'assets/achv-firsttry.png', '单题首次提交即通过', 5),
  ('streak_7',      '连续 7 天',  '连续打卡 7 天',            'assets/achv-streak7.png',  '连续打卡 7 天', 6),
  ('streak_30',     '全勤蛙',     '连续打卡 30 天',           'assets/achv-streak30.png', '连续打卡 30 天', 7),
  ('first_course',  '结课啦',     '完成第一门完整课程',       'assets/achv-course.png',   '完成第一门课程', 8),
  ('frog_doctor',   '蛙博士之路', '等级达到 Lv.5',            'assets/achv-doctor.png',   '等级达到 Lv.5', 9);

INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES
  (1, 1, '2026-10-29 19:20:00'),
  (1, 5, '2026-10-31 20:15:00'),
  (1, 6, '2026-11-04 21:10:00');

INSERT INTO messages (user_id, title, content, message_type, action_type, action_id, is_read, created_at) VALUES
  (1, '欢迎加入奶蛙 Python 学习平台', '完成首次学习即可解锁「第一行代码」成就。', 'system', 'page', NULL, 1, '2026-10-29 18:50:00'),
  (1, '解锁成就：一次就对', '你首次提交就通过了「打印你的名字」，太棒了！', 'achievement', 'achievement', 5, 0, '2026-10-31 20:15:00'),
  (1, '今天也该学习啦', '奶蛙提醒你：继续完成「2.2 用字符串拼接出一句问候」吧～', 'reminder', 'lesson', 4, 0, '2026-11-05 08:00:00'),
  (1, '本周学习报告已生成', '本周学习 98 分钟、完成 3 个课时，快来看看吧。', 'system', 'page', NULL, 0, '2026-11-05 09:00:00');

INSERT INTO user_daily_stats
  (user_id, stat_date, study_minutes, lessons_completed, questions_attempted, questions_passed, exp_earned, streak_days) VALUES
  (1, '2026-10-29', 10, 1, 0, 0,  30, 1),
  (1, '2026-10-30', 10, 0, 0, 0,  10, 2),
  (1, '2026-10-31', 18, 1, 1, 1,  60, 3),
  (1, '2026-11-01', 10, 0, 0, 0,  10, 4),
  (1, '2026-11-02', 20, 1, 1, 1,  60, 5),
  (1, '2026-11-03', 10, 0, 0, 0,  10, 6),
  (1, '2026-11-04', 20, 0, 1, 0,  60, 7),
  (2, '2026-11-02', 20, 0, 0, 0,  10, 1),
  (2, '2026-11-03', 15, 0, 0, 0,  10, 2),
  (2, '2026-11-04', 10, 0, 0, 0,  10, 3);

-- ============================================================
-- 八、执行结果校验
-- ============================================================
SELECT '数据库创建完成' AS 结果, COUNT(*) AS 表数量
FROM information_schema.tables
WHERE table_schema = 'naiwa_learning' AND table_type = 'BASE TABLE';

SELECT table_name AS 表名, table_comment AS 说明
FROM information_schema.tables
WHERE table_schema = 'naiwa_learning' AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT COUNT(*) AS 视图数量
FROM information_schema.views
WHERE table_schema = 'naiwa_learning';

SELECT * FROM v_course_overview;
SELECT * FROM v_user_learning_summary;
SELECT * FROM v_weekly_leaderboard;
SELECT * FROM v_mastery_target ORDER BY user_id, knowledge_point_id;
