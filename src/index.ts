import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { internalRoutes } from './routes/internal';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) => c.json({ ok: true, service: 'rezonans-backend' }));

app.route('/auth', authRoutes);
app.route('/me', meRoutes);
app.route('/internal', internalRoutes);

app.notFound((c) => c.json({ error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error('[unhandled]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`rezonans-backend listening on http://localhost:${info.port}`);
});
