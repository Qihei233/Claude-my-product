import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import contentRoutes from './routes/content.routes.js';
import stateRoutes from './routes/state.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      origin(origin, callback) {
        // 允许 curl / Postman 这类没有 Origin 的请求
        if (!origin || config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (req, res) => {
    res.json({
      code: 0,
      message: 'success',
      data: {
        status: 'ok',
        service: 'naiwa-backend',
        time: new Date().toISOString(),
      },
    });
  });

  const uploadDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../uploads',
  );
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/me', stateRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
