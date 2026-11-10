import { assertDbConnection, pool, query } from '../src/config/db.js';

try {
  const info = await assertDbConnection();
  const [users] = await query('SELECT COUNT(*) AS total FROM users');
  const [tables] = await query(
    `SELECT COUNT(*) AS total
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
  );

  console.log('✅ 数据库连接成功');
  console.log(`   MySQL 版本：${info.version}`);
  console.log(`   当前数据库：${info.db}`);
  console.log(`   表数量：${tables.total}`);
  console.log(`   用户数：${users.total}`);
} catch (error) {
  console.error('❌ 数据库连接失败：', error.message);
  console.error('   请确认 Docker 里的 mysql 容器已启动，并检查 .env 的 DB_PORT。');
  process.exitCode = 1;
} finally {
  await pool.end();
}
