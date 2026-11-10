import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './config/db.js';

const app = createApp();

async function start() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }

  app.listen(config.port, () => {
    console.log('奶蛙后台管理系统 · 后端已启动');
    console.log(`接口地址：http://localhost:${config.port}/api/admin`);
    console.log(`健康检查：http://localhost:${config.port}/api/admin/health`);
  });
}

start().catch((error) => {
  console.error('后台后端启动失败：', error.message);
  process.exit(1);
});
