import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';

const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
});

function extractId(inserted: unknown): number {
  const first = Array.isArray(inserted) ? inserted[0] : inserted;
  if (typeof first === 'object' && first !== null && 'id' in first) {
    return Number((first as { id: number | string }).id);
  }
  return Number(first);
}

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  // List comments for a book
  app.get('/api/books/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookId = Number(id);
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return reply.code(400).send({ error: 'Invalid book ID' });
    }

    const rows = await db('comments')
      .leftJoin('users', 'comments.user_id', 'users.id')
      .select(
        'comments.id',
        'comments.book_id',
        'comments.user_id',
        'comments.content',
        'comments.created_at',
        'users.username'
      )
      .where('comments.book_id', bookId)
      .orderBy('comments.created_at', 'desc');

    return {
      comments: rows.map((row) => ({
        id: Number(row.id),
        bookId: Number(row.book_id),
        userId: Number(row.user_id),
        username: row.username ?? 'Unknown',
        content: row.content,
        createdAt: row.created_at,
      })),
    };
  });

  // Add comment to a book
  app.post('/api/books/:id/comments', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookId = Number(id);
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return reply.code(400).send({ error: 'Invalid book ID' });
    }

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid comment' });
    }

    const book = await db('books').where({ id: bookId }).first();
    if (!book) {
      return reply.code(404).send({ error: 'Book not found' });
    }

    const inserted = await db('comments')
      .insert({
        book_id: bookId,
        user_id: request.user.id,
        content: parsed.data.content,
      })
      .returning('id');

    const commentId = extractId(inserted);

    return reply.code(201).send({
      comment: {
        id: commentId,
        bookId,
        userId: request.user.id,
        username: request.user.username,
        content: parsed.data.content,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Delete comment (author only)
  app.delete('/api/comments/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const commentId = Number(id);

    const comment = await db('comments').where({ id: commentId }).first();
    if (!comment) {
      return reply.code(404).send({ error: 'Comment not found' });
    }

    if (Number(comment.user_id) !== request.user.id) {
      return reply.code(403).send({ error: 'You can only delete your own comments' });
    }

    await db('comments').where({ id: commentId }).delete();
    return reply.code(204).send();
  });
}
