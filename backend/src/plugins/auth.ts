import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function registerAuthPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: '7d',
    },
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as AuthUser & { purpose?: string };
      if (payload.purpose || typeof payload.id !== 'number') {
        reply.code(401).send({ error: 'Authentication required' });
      }
    } catch {
      reply.code(401).send({ error: 'Authentication required' });
    }
  });
}
