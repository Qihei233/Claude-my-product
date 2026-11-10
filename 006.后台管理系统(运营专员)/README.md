# 奶蛙 Python 学习平台 · 后台管理系统

面向运营专员的**只读**后台管理系统，按
[`001-产品PRD/奶蛙Python学习平台-后台管理系统PRD.md`](../001-产品PRD/奶蛙Python学习平台-后台管理系统PRD.md)
实现。

## 硬性约束

- **只读**：后端所有业务查询均为 `SELECT`，不提供任何新增、修改、删除接口。
- **不修改数据库表结构**：不建表、不加字段、不加索引。
- 管理员登录不写数据库，凭据通过 `.env` 配置，Token 使用 HMAC 签名。

## 功能

- 登录（独立管理员账号，学生端账号不可登录）
- 数据概览：用户、活跃、课程、课时、题目、提交、通过率、近 7 日趋势、热门课程、最近注册
- 用户管理：列表、搜索、状态/注册时间筛选、用户详情（资料、报名、进度、提交、记录、统计、成就、兴趣、掌握度、消息、收藏）
- 课程管理：课程列表、详情、章节/课时、知识点、关联题目
- 题库管理：题目列表、详情、测试用例、提示、参考题解
- 学习数据：学习记录、提交记录、课时进度、每日统计、掌握度、周排行榜
- 运营数据：消息、收藏、推荐、学习报告、每日一题
- CSV 导出：用户、学习记录、提交记录（单次最多 10000 行）

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | React 19 + Vite 6 + TypeScript + React Router |
| 后端 | Node.js 18+ + Express 4 + mysql2 |
| 数据库 | 复用 `naiwa_learning`（MySQL，Docker 3307） |
| 鉴权 | bcrypt 校验管理员密码 + HMAC-SHA256 签名 Token |

## 目录结构

```text
006.后台管理系统(运营专员)/
├── frontend/          # React 后台界面，开发端口 5183
└── backend/           # Express 只读 API，端口 3101
```

## 启动

前置：Docker Desktop 已启动，MySQL 容器 `mysql` 在 3307 端口运行。

### 后端

```bash
cd backend
npm install
# 首次使用：复制 env.example 为 .env，并生成管理员密码哈希
npm run hash-password admin123
# 把输出中的哈希填入 .env 的 ADMIN_PASSWORD_HASH
npm run dev
```

后端地址：http://localhost:3101/api/admin

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问：http://localhost:5183

### 默认管理员

当前 `.env` 中配置为：

```text
账号：admin
密码：admin123
```

> 演示用账号。正式使用前请通过 `npm run hash-password` 生成新哈希并替换 `.env`，
> 同时更换 `ADMIN_TOKEN_SECRET`。

## 环境变量

见 `backend/env.example`：

- `PORT`：后台后端端口，默认 `3101`
- `DB_*`：数据库连接（复用学生端数据库）
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`：管理员凭据
- `ADMIN_TOKEN_SECRET`：Token 签名密钥
- `CORS_ORIGINS`：允许的后台前端地址

前端变量在 `frontend/.env.example`：`VITE_API_BASE_URL=http://localhost:3101`。

## 只读实现说明

`backend/src/config/db.js` 中的 `query()` 会拒绝任何非 `SELECT` 语句；
业务代码中没有写库接口。管理员登录和 Token 校验都在内存中完成，不写 `sessions` 表。

## 已验证

- 后端：登录、概览、用户/课程/题库、学习/运营数据、导出接口均返回真实数据库数据
- 前端：所有页面在无头浏览器中完成渲染验证
- 数据库：未执行任何写入或结构变更
