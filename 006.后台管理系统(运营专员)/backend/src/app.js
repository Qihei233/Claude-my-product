import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan('dev'));

  app.get('/api/admin/health', (req, res) => {
    res.json({
      code: 0,
      message: 'success',
      data: { status: 'ok', service: 'naiwa-admin-backend' },
    });
  });

  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
