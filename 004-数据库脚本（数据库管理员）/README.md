# 004 数据库脚本（数据库管理员）

奶蛙 Python 学习平台 · 第 15 组 · 实验五

## 文件说明

- `naiwa_learning.sql`：完整建库脚本，包含 30 张表、5 个视图和演示数据。
- 脚本可重复执行：开头会 `DROP DATABASE IF EXISTS naiwa_learning`，然后重建。

## 执行环境

- Docker Desktop + MySQL 9.7.0
- 容器名：`mysql`
- 宿主机端口：`3307` → 容器端口 `3306`
- 账号：`root / root`

## 执行方式

在项目根目录执行：

```bash
docker cp "004-数据库脚本（数据库管理员）/naiwa_learning.sql" mysql:/tmp/naiwa_learning.sql
docker exec -i mysql mysql -uroot -proot --default-character-set=utf8mb4 < "004-数据库脚本（数据库管理员）/naiwa_learning.sql"
```

执行完成后校验：

```bash
docker exec mysql mysql -uroot -proot --default-character-set=utf8mb4 \
  -e "USE naiwa_learning; SHOW TABLES; SELECT * FROM v_mastery_target;"
```

## 设计要点

- 自适应学习：`user_behaviors`（行为埋点）、`user_interests`（兴趣标签）、
  `mastery_scores`（掌握度 0-1）、`questions.difficulty`（难度 1-5）、
  `learning_recommendations`（个性化推荐）。
- 内容推荐：`course_tags` × `user_interests` 标签相似度；
  协同过滤：`user_behaviors` 中相似用户的行为。
- 数据完整性：主外键、唯一约束、CHECK 约束、组合索引；
  教程内容 / 提示 / 失败用例使用 JSON 存储。
- 视图：`v_course_overview`、`v_user_learning_summary`、
  `v_weekly_leaderboard`、`v_user_question_status`、`v_mastery_target`。
