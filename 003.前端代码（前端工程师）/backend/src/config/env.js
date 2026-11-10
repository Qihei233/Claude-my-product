import 'dotenv/config';

function numberEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`环境变量 ${name} 必须是数字`);
  return parsed;
}

function boolEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

export const config = {
  nodeEnv,
  isProd,
  port: numberEnv('PORT', 3001),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: numberEnv('DB_PORT', 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'naiwa_learning',
  },

  corsOrigins: (process.env.CORS_ORIGINS ||
    'http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),

  bcryptRounds: numberEnv('BCRYPT_ROUNDS', 12),

  session: {
    rememberDays: numberEnv('SESSION_DAYS', 7),
    shortHours: numberEnv('SESSION_SHORT_HOURS', 24),
  },

  verification: {
    ttlMinutes: numberEnv('CODE_TTL_MINUTES', 5),
    secret: process.env.CODE_SECRET || 'dev-only-code-secret-change-me',
    devReturn: boolEnv('CODE_DEV_RETURN', !isProd),
  },
};

if (isProd && config.verification.devReturn) {
  throw new Error('生产环境必须设置 CODE_DEV_RETURN=false');
}

if (isProd && config.verification.secret === 'dev-only-code-secret-change-me') {
  throw new Error('生产环境必须设置 CODE_SECRET');
}
