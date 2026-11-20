import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { checkDatabaseHealth } from '../db/index.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    const dbHealthy = await checkDatabaseHealth();
    const status = dbHealthy ? 'ok' : 'degraded';

    return reply.code(dbHealthy ? 200 : 503).send({
      status,
      instanceId: config.instanceId,
      storageDriver: config.storageDriver,
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });
}
