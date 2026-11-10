# 奶蛙 Python 学习平台 · 后端（登录 / 注册）

实验五后续：在已有前端、PRD、MySQL 数据库设计的基础上，先实现登录与注册。

## 一、技术选型建议

前端已经是 React（构建产物使用 React + React Router），不需要再选前端框架；这里要选的是**后端框架**。

| 框架 | 特点 | 适合场景 |
| --- | --- | --- |
| **Express（已采用）** | 最简单、生态最大、资料多，JavaScript 直接上手 | 课程项目、快速实现登录/注册和业务接口 |
| Fastify | 性能更好、内置 Schema 校验 | 对性能或接口规范要求更高 |
| NestJS | TypeScript、模块化、企业级结构 | 大型团队、长期维护 |
| Koa | 轻量、洋葱模型中间件 | 喜欢极简风格 |

本项目选择 **Express + mysql2 + bcryptjs + 不透明 Session Token**：

- 后端语言为 JavaScript，与前端一致；
- 直接使用现有 `naiwa_learning` 数据库，不引入 ORM，表结构清晰可见；
- 登录态存入 `sessions` 表（数据库设计里已有），不把用户信息塞进 JWT；
- 密码用 bcrypt 哈希，验证码只存 HMAC 哈希，不存明文。

## 二、目录结构

```text
003.前端代码（前端工程师）/backend/
├─ package.json
├─ env.example
├─ .env                  # 本地配置，已加入 .gitignore
├─ src/
│  ├─ app.js             # Express 应用
│  ├─ server.js          # 启动入口
│  ├─ config/
│  │  ├─ env.js          # 环境变量
│  │  └─ db.js           # MySQL 连接池 / 事务
│  ├─ controllers/
│  │  └─ auth.controller.js
│  ├─ services/
│  │  ├─ auth.service.js
│  │  └─ verification.service.js
│  ├─ routes/
│  │  └─ auth.routes.js
│  ├─ middleware/
│  │  ├─ auth.js         # Bearer Token 校验
│  │  ├─ error.js
│  │  └─ validate.js
│  ├─ validators/
│  │  └─ auth.js         # Zod 参数校验
│  └─ utils/
│     ├─ http.js
│     ├─ password.js
│     ├─ token.js
│     └─ verification.js
└─ scripts/
   ├─ check-db.js        # 数据库连通性检查
   └─ smoke.mjs          # 登录/注册冒烟测试
```

## 三、运行

### 1. 确认数据库

Docker 容器 `mysql` 已启动，宿主机端口 **3307**，数据库 **naiwa_learning**。

```bash
docker ps
docker exec mysql mysql -uroot -proot -e "USE naiwa_learning; SHOW TABLES;"
```

如果你的 MySQL 在 3306，把 `.env` 里的 `DB_PORT` 改成 3306。

### 2. 安装依赖

```bash
cd "003.前端代码（前端工程师）/backend"
npm install
```

### 3. 启动

```bash
npm run dev
```

看到以下输出即成功：

```text
奶蛙 Python 学习平台 · 后端已启动
接口地址：http://localhost:3001/api
健康检查：http://localhost:3001/api/health
```

### 4. 验证

```bash
npm run check-db
npm run smoke
```

`npm run smoke` 会真实走一遍：发送验证码 → 注册 → 获取当前用户 → 退出登录 → 密码登录。测试会创建一个 `smoke_xxx@example.com` 的测试用户。

演示账号（数据库种子数据已写入）：

- 邮箱：`xiaolin@example.com`
- 手机号：`13800001111`
- 密码：`abc12345`
- 张姐账号（`13900002222` / `zhangjie@example.com`）使用同一密码。

## 四、接口

统一响应格式：

```json
{ "code": 0, "message": "success", "data": {} }
```

失败时 HTTP 状态码为 4xx/5xx，`code` 为对应错误码，`message` 为中文提示。

### 1. 发送验证码

```http
POST /api/auth/send-code
Content-Type: application/json
```

```json
{
  "accountType": "email",
  "account": "test@example.com",
  "purpose": "register"
}
```

`accountType`：`phone` / `email`；`purpose`：`register` / `login` / `reset_password`。

开发环境响应会带 `devCode`（生产环境关闭）：

```json
{
  "code": 0,
  "message": "success",
  "data": { "expiresIn": 300, "devCode": "123456" }
}
```

### 2. 注册（自动登录）

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "accountType": "email",
  "account": "test@example.com",
  "code": "123456",
  "password": "abc12345",
  "nickname": "小林",
  "agreed": true
}
```

`nickname` 可选；不传时后端会自动生成一个不重复的昵称（如 `奶蛙2545`）。

成功返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "……",
    "expiresAt": "2026-11-11T10:00:00.000Z",
    "user": {
      "userId": "3",
      "nickname": "小林",
      "avatar": null,
      "phone": null,
      "email": "te***@example.com",
      "role": "student",
      "level": 1,
      "exp": 0,
      "streakDays": 0,
      "dailyGoalMinutes": 30,
      "onboardingCompleted": false
    }
  }
}
```

### 3. 密码登录

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "account": "test@example.com",
  "password": "abc12345",
  "rememberMe": false
}
```

`rememberMe=true` 时会话 7 天，否则 24 小时。

登录失败时：

- 前 2 次：`401 账号或密码不正确`
- 第 3 次起：返回 `details.needCaptcha=true`（前端可展示图形验证码）
- 累计 5 次：锁定 15 分钟，返回 `423`

### 4. 验证码登录

```http
POST /api/auth/login-code
Content-Type: application/json
```

```json
{
  "accountType": "phone",
  "account": "13800001111",
  "code": "123456"
}
```

### 5. 当前用户

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 6. 退出登录

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

会删除数据库里对应的 `sessions` 记录。

## 五、前端如何接

前端把原来的 mock 登录替换成：

```js
const BASE_URL = 'http://localhost:3001';

async function login(account, password, rememberMe) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password, rememberMe }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  localStorage.setItem('naiwa_token', json.data.token);
  return json.data.user;
}
```

后续请求统一带：

```js
headers: { Authorization: `Bearer ${localStorage.getItem('naiwa_token')}` }
```

CORS 已允许：

- `http://localhost:4173`（当前构建版）
- `http://localhost:5173`（Vite 开发）
- `http://127.0.0.1:4173` / `http://127.0.0.1:5173`

如果前端端口不同，改 `.env` 的 `CORS_ORIGINS`。

> 当前仓库里只有前端构建产物，没有 React 源码；接口已经按 PRD 的字段设计好。拿到 003 前端源码后，把 mock 数据层替换为这些接口即可。

## 六、数据库字段对应

| 接口 | 使用的表 |
| --- | --- |
| 发送验证码 | `verification_codes` |
| 注册 | `users`、`user_profiles`、`verification_codes`、`sessions` |
| 密码登录 | `users`、`sessions` |
| 验证码登录 | `verification_codes`、`users`、`sessions` |
| 当前用户 | `sessions`、`users`、`user_profiles` |
| 退出登录 | `sessions` |

注册时会自动创建 `user_profiles` 记录，等级、经验、连续打卡等字段使用默认值。

## 七、安全与后续

已实现：

- 密码 bcrypt 哈希；
- 验证码 HMAC-SHA256 存储，5 分钟过期、一次性使用；
- 发送验证码 60 秒限流、单日 10 次上限；
- 登录失败计数、5 次锁定 15 分钟；
- 登录态存数据库，Token 只存 SHA-256 哈希；
- Helmet、CORS、请求体大小限制、Zod 参数校验。

生产环境还需要：

- 把 `CODE_DEV_RETURN` 设为 `false`，接入真实短信/邮件服务；
- 设置强随机 `CODE_SECRET`；
- 图形验证码（第 3 次失败后）的校验；
- HTTPS、反向代理、日志与监控；
- 找回密码接口（表结构 `verification_codes.purpose=reset_password` 已预留）。

## 八、常见问题

**端口 3001 被占用**

改 `.env` 的 `PORT`。

**数据库连接失败**

```bash
docker ps
docker exec mysql mysql -uroot -proot -e "SELECT VERSION();"
```

确认 `.env` 的 `DB_PORT=3307`（当前 Docker 映射端口）。

**注册提示验证码错误**

开发环境用 `send-code` 返回的 `devCode`；验证码 5 分钟过期，且只能使用一次。
