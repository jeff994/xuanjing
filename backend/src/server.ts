import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { config } from './config.js';
import { db, initDatabase } from './db/index.js';
import { registerAuthPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { bookRoutes } from './routes/books.js';
import { commentRoutes } from './routes/comments.js';
import { healthRoutes } from './routes/health.js';
import { oauthRoutes } from './routes/oauth.js';
import { storage } from './storage/index.js';

async function start() {
  const app = Fastify({
    logger: true,
    trustProxy: true, // Required behind load balancers (Nginx / ALB / Traefik)
  });

  // Attach instance ID header to every response so load balancing is easy to verify
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-API-Instance', config.instanceId);
    return payload;
  });

  await app.register(cors, {
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: 2,
    },
  });

  await registerAuthPlugin(app);

  // Initialize shared DB & object storage before accepting traffic
  await initDatabase();
  await storage.init();

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(oauthRoutes);
  await app.register(bookRoutes);
  await app.register(commentRoutes);

  // Graceful shutdown for zero-downtime rolling updates behind a load balancer
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    await db.destroy();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Book Portal API [${config.instanceId}] listening on http://${config.host}:${config.port}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
