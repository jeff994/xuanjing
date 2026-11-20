import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';

const registerSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(40),
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

function extractId(inserted: unknown): number {
  const first = Array.isArray(inserted) ? inserted[0] : inserted;
  if (typeof first === 'object' && first !== null && 'id' in first) {
    return Number((first as { id: number | string }).id);
  }
  return Number(first);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    }

    const { username, email, password } = parsed.data;

    const existing = await db('users')
      .where({ email })
      .orWhere({ username })
      .first();

    if (existing) {
      return reply.code(409).send({ error: 'Username or email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db('users')
      .insert({
        username,
        email,
        password_hash: passwordHash,
      })
      .returning('id');

    const id = extractId(inserted);
    const user = { id, username, email };
    const token = app.jwt.sign(user);

    return reply.code(201).send({ user, token });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Valid email and password are required' });
    }

    const { email, password } = parsed.data;
    const row = await db('users').where({ email }).first();

    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const user = { id: Number(row.id), username: row.username as string, email: row.email as string };
    const token = app.jwt.sign(user);

    return reply.send({ user, token });
  });

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    return { user: request.user };
  });
}
