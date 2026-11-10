# 奶蛙 Python 学习平台

课程项目完整目录。

```text
claude-my-product/
├── 001-产品PRD/                    # 后台管理系统 PRD
├── 003.前端代码（前端工程师）/
│   ├── frontend/                   # 学生端 React + Vite，开发端口 5173
│   └── backend/                    # 学生端 Express API，端口 3001
├── 004-数据库脚本（数据库管理员）/  # 数据库设计与初始化脚本
├── 006.后台管理系统(运营专员)/
│   ├── frontend/                   # 运营后台 React + Vite，端口 5183
│   └── backend/                    # 运营后台只读 API，端口 3101
├── database/                       # 数据库脚本与截图
└── 一键启动完整网站.bat
```

## 快速启动

1. 启动 Docker Desktop（MySQL 容器会自动启动，宿主机端口 3307）。
2. 双击项目根目录的 `一键启动完整网站.bat`。
   - 学生端：http://localhost:5173
   - 后台管理系统：http://localhost:5183（默认 admin / admin123）

也可以按各目录 README 手动启动：

- 学生端：`003.前端代码（前端工程师）/backend` → `npm run dev`；`frontend` → `npm run dev`
- 后台：`006.后台管理系统(运营专员)/backend` → `npm run dev`；`frontend` → `npm run dev`

## 已实现

- 学生端：登录/注册/找回密码、课程学习、真实 Python 判题、学习记录、排行榜、消息、成就、收藏、个人设置、新手引导、站内提醒
- 后台管理系统：只读数据管理（用户、课程、题库、学习数据、运营数据），CSV 导出，不修改数据库
- 一键启动脚本同时拉起两套系统的前后端

详细说明见各目录下的 `README.md`。
