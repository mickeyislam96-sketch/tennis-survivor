/**
 * Test Express app — mounts the production routers on a fresh instance
 * without the side effects that index.js triggers on import (cron jobs,
 * schema init, app.listen).
 *
 * Use with supertest:
 *
 *   import request from 'supertest';
 *   import { buildTestApp } from './testApp.js';
 *
 *   const app = await buildTestApp();
 *   const res = await request(app).get('/api/health');
 */
import express from 'express';
import cookieParser from 'cookie-parser';

import { groupsRouter } from '../../src/routes/groups.js';
import { picksRouter } from '../../src/routes/picks.js';
import { drawRouter } from '../../src/routes/draw.js';
import { leaderboardRouter } from '../../src/routes/leaderboard.js';
import { authRouter } from '../../src/routes/auth.js';
import { poolsRouter } from '../../src/routes/pools.js';
import { healthRouter } from '../../src/routes/health.js';
import { paymentsRouter } from '../../src/routes/payments.js';
import { adminRouter } from '../../src/routes/admin.js';

export function buildTestApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/picks', picksRouter);
  app.use('/api/draw', drawRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/pools', poolsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  return app;
}
