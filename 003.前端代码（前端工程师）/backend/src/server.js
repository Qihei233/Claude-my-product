import { createApp } from './app.js';
import { config } from './config/env.js';
import { assertDbConnection, pool } from './config/db.js';

const app = createApp();

async function start() {
  try {
    const dbInfo = await assertDbConnection();

    const server = app.listen(config.port, () => {
      console.log('');
      console.log('奶蛙 Python 学习平台 · 后端已启动');
      console.log(`接口地址：http://localhost:${config.port}/api`);
      console.log(`健康检查：http://localhost:${config.port}/api/health`);
      console.log(`环境：${config.nodeEnv}`);
      console.log(
        `数据库：${config.db.host}:${config.db.port}/${config.db.database}（MySQL ${dbInfo.version}）`,
      );
      console.log('');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`端口 ${config.port} 已被占用，请修改 .env 里的 PORT。`);
      } else {
        console.error('服务启动失败：', error);
      }
      process.exit(1);
    });

    const shutdown = (signal) => {
      console.log(`\n收到 ${signal}，正在关闭服务...`);
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('数据库连接失败：', error.message);
    console.error('请确认 Docker 里的 mysql 容器已启动，且 .env 里的 DB_PORT 正确。');
    process.exit(1);
  }
}

start();
