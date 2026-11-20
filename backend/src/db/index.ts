import fs from 'node:fs';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { config } from '../config.js';

const isPostgres = config.databaseUrl.startsWith('postgres://') || config.databaseUrl.startsWith('postgresql://');

if (!isPostgres) {
  fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
}

export const db: Knex = isPostgres
  ? knex({
      client: 'pg',
      connection: config.databaseUrl,
      pool: { min: 2, max: 10 },
    })
  : knex({
      client: 'sqlite3',
      connection: {
        filename: config.sqlitePath,
      },
      useNullAsDefault: true,
      pool: {
        afterCreate: (conn: { run: (sql: string, cb: (err?: Error) => void) => void }, done: (err?: Error) => void) => {
          conn.run('PRAGMA foreign_keys = ON', done);
        },
      },
    });

export async function initDatabase(): Promise<void> {
  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('username', 80).notNullable().unique();
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasBooks = await db.schema.hasTable('books');
  if (!hasBooks) {
    await db.schema.createTable('books', (table) => {
      table.increments('id').primary();
      table.string('title', 255).notNullable();
      table.string('author', 255).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.string('file_key', 512).notNullable();
      table.string('file_name', 255).notNullable();
      table.string('file_mime', 120).notNullable();
      table.integer('file_size').notNullable();
      table.string('cover_key', 512).nullable();
      table.string('cover_mime', 120).nullable();
      table.integer('uploaded_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasComments = await db.schema.hasTable('comments');
  if (!hasComments) {
    await db.schema.createTable('comments', (table) => {
      table.increments('id').primary();
      table.integer('book_id').unsigned().notNullable().references('id').inTable('books').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.text('content').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
