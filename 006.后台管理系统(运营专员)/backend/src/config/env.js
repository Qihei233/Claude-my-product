import 'dotenv/config';

function numberEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`环境变量 ${name} 必须是数字`);
  return parsed;
}

export const config = {
  port: numberEnv('PORT', 3101),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: numberEnv('DB_PORT', 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'naiwa_learning',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    tokenSecret: process.env.ADMIN_TOKEN_SECRET || '',
    tokenHours: 2,
  },
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    'http://localhost:5183,http://127.0.0.1:5183'
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
};

if (!config.admin.passwordHash) {
  throw new Error('缺少 ADMIN_PASSWORD_HASH，请先运行 npm run hash-password 并写入 .env');
}
if (!config.admin.tokenSecret || config.admin.tokenSecret.length < 16) {
  throw new Error('缺少 ADMIN_TOKEN_SECRET（至少 16 位）');
}
