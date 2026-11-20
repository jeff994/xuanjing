import crypto from 'node:crypto';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { storage } from '../storage/index.js';

const ALLOWED_BOOK_EXTS = new Set(['.pdf', '.epub', '.txt', '.md', '.mobi']);
const ALLOWED_COVER_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function extractId(inserted: unknown): number {
  const first = Array.isArray(inserted) ? inserted[0] : inserted;
  if (typeof first === 'object' && first !== null && 'id' in first) {
    return Number((first as { id: number | string }).id);
  }
  return Number(first);
}

function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function bookRoutes(app: FastifyInstance): Promise<void> {
  // List & search books
  app.get('/api/books', async (request) => {
    const { q } = request.query as { q?: string };
    const search = q?.trim().toLowerCase();

    const query = db('books')
      .leftJoin('users', 'books.uploaded_by', 'users.id')
      .leftJoin('comments', 'books.id', 'comments.book_id')
      .select(
        'books.id',
        'books.title',
        'books.author',
        'books.description',
        'books.file_name',
        'books.file_mime',
        'books.file_size',
        'books.cover_key',
        'books.uploaded_by',
        'books.created_at',
        'users.username as uploader_username'
      )
      .count('comments.id as comment_count')
      .groupBy('books.id', 'users.username')
      .orderBy('books.created_at', 'desc');

    if (search) {
      query.where((qb) => {
        qb.whereRaw('LOWER(books.title) LIKE ?', [`%${search}%`])
          .orWhereRaw('LOWER(books.author) LIKE ?', [`%${search}%`])
          .orWhereRaw('LOWER(books.description) LIKE ?', [`%${search}%`]);
      });
    }

    const rows = await query;

    return {
      books: rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        author: row.author,
        description: row.description,
        fileName: row.file_name,
        fileMime: row.file_mime,
        fileSize: Number(row.file_size),
        coverUrl: row.cover_key ? `/api/books/${row.id}/cover` : null,
        downloadUrl: `/api/books/${row.id}/download`,
        uploadedBy: Number(row.uploaded_by),
        uploaderUsername: row.uploader_username ?? 'Unknown',
        commentCount: Number(row.comment_count ?? 0),
        createdAt: row.created_at,
      })),
    };
  });

  // Get single book details
  app.get('/api/books/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bookId = Number(id);
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return reply.code(400).send({ error: 'Invalid book ID' });
    }

    const row = await db('books')
      .leftJoin('users', 'books.uploaded_by', 'users.id')
      .select(
        'books.*',
        'users.username as uploader_username'
      )
      .where('books.id', bookId)
      .first();

    if (!row) {
      return reply.code(404).send({ error: 'Book not found' });
    }

    const countRow = await db('comments').where({ book_id: bookId }).count('id as count').first();

    return {
      book: {
        id: Number(row.id),
        title: row.title,
        author: row.author,
        description: row.description,
        fileName: row.file_name,
        fileMime: row.file_mime,
        fileSize: Number(row.file_size),
        coverUrl: row.cover_key ? `/api/books/${row.id}/cover` : null,
        downloadUrl: `/api/books/${row.id}/download`,
        uploadedBy: Number(row.uploaded_by),
        uploaderUsername: row.uploader_username ?? 'Unknown',
        commentCount: Number(countRow?.count ?? 0),
        createdAt: row.created_at,
      },
    };
  });

  // Upload a new book (multipart/form-data: title, author, description, bookFile, coverFile?)
  app.post('/api/books', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parts = request.parts();

    let title = '';
    let author = '';
    let description = '';
    let bookFile: { buffer: Buffer; filename: string; mimetype: string } | null = null;
    let coverFile: { buffer: Buffer; filename: string; mimetype: string } | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        if (part.fieldname === 'bookFile') {
          bookFile = { buffer, filename: part.filename, mimetype: part.mimetype };
        } else if (part.fieldname === 'coverFile' && buffer.length > 0) {
          coverFile = { buffer, filename: part.filename, mimetype: part.mimetype };
        }
      } else {
        const value = String(part.value ?? '').trim();
        if (part.fieldname === 'title') title = value;
        if (part.fieldname === 'author') author = value;
        if (part.fieldname === 'description') description = value;
      }
    }

    if (!title || !author) {
      return reply.code(400).send({ error: 'Title and author are required' });
    }

    if (!bookFile || bookFile.buffer.length === 0) {
      return reply.code(400).send({ error: 'A book file (PDF, EPUB, TXT, MD, or MOBI) is required' });
    }

    const bookExt = path.extname(bookFile.filename).toLowerCase();
    if (!ALLOWED_BOOK_EXTS.has(bookExt)) {
      return reply.code(400).send({
        error: `Unsupported book file type (${bookExt || 'unknown'}). Allowed: PDF, EPUB, TXT, MD, MOBI`,
      });
    }

    const uuid = crypto.randomUUID();
    const safeBookName = sanitizeFilename(bookFile.filename);
    const fileKey = `books/${uuid}-${safeBookName}`;
    await storage.upload(fileKey, bookFile.buffer, bookFile.mimetype || 'application/octet-stream');

    let coverKey: string | null = null;
    let coverMime: string | null = null;
    if (coverFile) {
      const coverExt = path.extname(coverFile.filename).toLowerCase();
      if (!ALLOWED_COVER_EXTS.has(coverExt)) {
        await storage.delete(fileKey);
        return reply.code(400).send({
          error: 'Unsupported cover image type. Allowed: JPG, PNG, WEBP',
        });
      }
      coverKey = `covers/${uuid}-${sanitizeFilename(coverFile.filename)}`;
      coverMime = coverFile.mimetype || 'image/jpeg';
      await storage.upload(coverKey, coverFile.buffer, coverMime);
    }

    const inserted = await db('books')
      .insert({
        title,
        author,
        description,
        file_key: fileKey,
        file_name: safeBookName,
        file_mime: bookFile.mimetype || 'application/octet-stream',
        file_size: bookFile.buffer.length,
        cover_key: coverKey,
        cover_mime: coverMime,
        uploaded_by: request.user.id,
      })
      .returning('id');

    const bookId = extractId(inserted);

    return reply.code(201).send({
      book: {
        id: bookId,
        title,
        author,
        description,
        fileName: safeBookName,
        fileMime: bookFile.mimetype || 'application/octet-stream',
        fileSize: bookFile.buffer.length,
        coverUrl: coverKey ? `/api/books/${bookId}/cover` : null,
        downloadUrl: `/api/books/${bookId}/download`,
        uploadedBy: request.user.id,
        uploaderUsername: request.user.username,
        commentCount: 0,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Download book file
  app.get('/api/books/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await db('books').where({ id: Number(id) }).first();
    if (!book) {
      return reply.code(404).send({ error: 'Book not found' });
    }

    try {
      const stream = await storage.getStream(book.file_key);
      reply.header('Content-Type', book.file_mime || 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${book.file_name}"`);
      return reply.send(stream);
    } catch {
      return reply.code(404).send({ error: 'Book file missing from storage' });
    }
  });

  // Serve book cover image
  app.get('/api/books/:id/cover', async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await db('books').where({ id: Number(id) }).first();
    if (!book || !book.cover_key) {
      return reply.code(404).send({ error: 'Cover not found' });
    }

    try {
      const stream = await storage.getStream(book.cover_key);
      reply.header('Content-Type', book.cover_mime || 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(stream);
    } catch {
      return reply.code(404).send({ error: 'Cover image missing from storage' });
    }
  });

  // Delete book (uploader only)
  app.delete('/api/books/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const book = await db('books').where({ id: Number(id) }).first();

    if (!book) {
      return reply.code(404).send({ error: 'Book not found' });
    }

    if (Number(book.uploaded_by) !== request.user.id) {
      return reply.code(403).send({ error: 'You can only delete books you uploaded' });
    }

    await db('books').where({ id: book.id }).delete();
    await storage.delete(book.file_key).catch(() => undefined);
    if (book.cover_key) {
      await storage.delete(book.cover_key).catch(() => undefined);
    }

    return reply.code(204).send();
  });
}
