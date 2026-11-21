import assert from 'node:assert/strict';
import { ChildProcess, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const TEST_PORT = 4199;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const JWT_SECRET = 'test-suite-jwt-secret-987654321';

let serverProc: ChildProcess;
let tempDir: string;

function signTestJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ ...payload, iat: now, exp: now + 300 });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function waitForHealth(url: string, retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Backend server did not become healthy in time');
}

describe('Book Portal REST API', () => {
  before(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'book-portal-test-'));
    const serverEntry = path.resolve(process.cwd(), 'dist/server.js');

    serverProc = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        HOST: '127.0.0.1',
        JWT_SECRET,
        INSTANCE_ID: 'test-replica-1',
        FRONTEND_URL: 'http://localhost:5173',
        API_PUBLIC_URL: BASE_URL,
        SQLITE_PATH: path.join(tempDir, 'test.sqlite'),
        LOCAL_UPLOAD_DIR: path.join(tempDir, 'uploads'),
        DATABASE_URL: '',
        STORAGE_DRIVER: 'local',
        GOOGLE_CLIENT_ID: 'test-google-id',
        GOOGLE_CLIENT_SECRET: 'test-google-secret',
        WECHAT_APP_ID: 'test-wechat-id',
        WECHAT_APP_SECRET: 'test-wechat-secret',
        FACEBOOK_APP_ID: 'test-facebook-id',
        FACEBOOK_APP_SECRET: 'test-facebook-secret',
      },
      stdio: 'pipe',
    });

    await waitForHealth(`${BASE_URL}/api/health`);
  });

  after(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 250));
    }
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns healthy status and X-API-Instance header', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-api-instance'), 'test-replica-1');
    const body = (await res.json()) as { status: string; instanceId: string; database: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.instanceId, 'test-replica-1');
    assert.equal(body.database, 'connected');
  });

  it('supports user registration, login, book upload, comments, download, and owner-only delete', async () => {
    // Register user 1
    const reg1 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', email: 'alice@example.com', password: 'password123' }),
    });
    assert.equal(reg1.status, 201);
    const alice = (await reg1.json()) as { user: { id: number; username: string }; token: string };

    // Duplicate email rejected
    const dup = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice2', email: 'alice@example.com', password: 'password123' }),
    });
    assert.equal(dup.status, 409);

    // Login with wrong password rejected
    const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'wrong' }),
    });
    assert.equal(badLogin.status, 401);

    // Register user 2
    const reg2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', email: 'bob@example.com', password: 'password123' }),
    });
    assert.equal(reg2.status, 201);
    const bob = (await reg2.json()) as { user: { id: number }; token: string };

    // Upload a book as Alice
    const form = new FormData();
    form.append('title', 'Designing Data-Intensive Applications');
    form.append('author', 'Martin Kleppmann');
    form.append('description', 'Distributed systems guide');
    form.append('bookFile', new Blob(['Chapter 1: Reliable Systems'], { type: 'text/plain' }), 'ddia.txt');

    const uploadRes = await fetch(`${BASE_URL}/api/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${alice.token}` },
      body: form,
    });
    assert.equal(uploadRes.status, 201);
    const { book } = (await uploadRes.json()) as { book: { id: number; title: string } };

    // Bob comments on Alice's book
    const commentRes = await fetch(`${BASE_URL}/api/books/${book.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bob.token}` },
      body: JSON.stringify({ content: 'Must-read classic!' }),
    });
    assert.equal(commentRes.status, 201);

    // Search books & verify commentCount
    const listRes = await fetch(`${BASE_URL}/api/books?q=kleppmann`);
    assert.equal(listRes.status, 200);
    const listData = (await listRes.json()) as { books: Array<{ id: number; commentCount: number }> };
    assert.equal(listData.books.length, 1);
    assert.equal(listData.books[0].commentCount, 1);

    // Download book content
    const dlRes = await fetch(`${BASE_URL}/api/books/${book.id}/download`);
    assert.equal(dlRes.status, 200);
    assert.equal(await dlRes.text(), 'Chapter 1: Reliable Systems');

    // Bob cannot delete Alice's book
    const forbiddenDel = await fetch(`${BASE_URL}/api/books/${book.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    assert.equal(forbiddenDel.status, 403);

    // Alice can delete her own book
    const okDel = await fetch(`${BASE_URL}/api/books/${book.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    assert.equal(okDel.status, 204);
  });

  it('enforces browser-bound OAuth tx and ownership-proof linking', async () => {
    // Providers endpoint lists google, wechat, facebook
    const provRes = await fetch(`${BASE_URL}/api/auth/providers`);
    assert.equal(provRes.status, 200);
    const { providers } = (await provRes.json()) as { providers: Array<{ id: string; enabled: boolean }> };
    assert.deepEqual(
      providers.map((p) => p.id),
      ['google', 'wechat', 'facebook']
    );
    assert.ok(providers.every((p) => p.enabled));

    // OAuth start without tx is rejected
    const noTx = await fetch(`${BASE_URL}/api/auth/oauth/google`, { redirect: 'manual' });
    assert.equal(noTx.status, 302);
    assert.match(noTx.headers.get('location') ?? '', /\/login\?error=/);

    // OAuth start with valid tx redirects to each provider
    const tx = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
    for (const [provider, host] of [
      ['google', 'accounts.google.com'],
      ['wechat', 'open.weixin.qq.com'],
      ['facebook', 'www.facebook.com'],
    ] as const) {
      const r = await fetch(`${BASE_URL}/api/auth/oauth/${provider}?tx=${tx}&next=/upload`, { redirect: 'manual' });
      assert.equal(r.status, 302);
      const loc = r.headers.get('location') ?? '';
      assert.equal(new URL(loc).hostname, host);
      assert.ok(loc.includes('state='));
    }

    // Register victim & attacker accounts
    const victimReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'victim_user', email: 'victim@gmail.com', password: 'victim-password' }),
    });
    const victim = (await victimReg.json()) as { user: { id: number }; token: string };

    const attackerReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'attacker_user', email: 'attacker@gmail.com', password: 'attacker-password' }),
    });
    const attacker = (await attackerReg.json()) as { user: { id: number }; token: string };

    // Exchange token cannot be used as Bearer session JWT
    const exchangeToken = signTestJwt({ purpose: 'oauth_exchange', userId: victim.user.id, tx, next: '/upload' });
    const meWithExchange = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${exchangeToken}` },
    });
    assert.equal(meWithExchange.status, 401);

    // Raw attacker session JWT cannot be exchanged
    const rawExchange = await fetch(`${BASE_URL}/api/auth/oauth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeToken: attacker.token, tx }),
    });
    assert.equal(rawExchange.status, 401);

    // Mismatched tx rejected on exchange
    const badTxExchange = await fetch(`${BASE_URL}/api/auth/oauth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeToken, tx: 'ffffffffffffffffffffffffffffffff' }),
    });
    assert.equal(badTxExchange.status, 401);

    // Matching tx succeeds on exchange
    const okExchange = await fetch(`${BASE_URL}/api/auth/oauth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeToken, tx }),
    });
    assert.equal(okExchange.status, 200);
    const exchanged = (await okExchange.json()) as { user: { id: number }; token: string; next: string };
    assert.equal(exchanged.user.id, victim.user.id);
    assert.equal(exchanged.next, '/upload');

    // Ownership-proof linking: rejects wrong password, wrong user JWT, and mismatched tx
    const linkToken = signTestJwt({
      purpose: 'oauth_link',
      tx,
      next: '/',
      profile: {
        provider: 'google',
        providerUserId: 'google-sub-victim',
        email: 'victim@gmail.com',
        displayName: 'Victim',
        avatarUrl: null,
      },
    });

    const linkWrongPwd = await fetch(`${BASE_URL}/api/auth/oauth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkToken, tx, password: 'wrong-password' }),
    });
    assert.equal(linkWrongPwd.status, 401);

    const linkWrongUser = await fetch(`${BASE_URL}/api/auth/oauth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${attacker.token}` },
      body: JSON.stringify({ linkToken, tx }),
    });
    assert.equal(linkWrongUser.status, 401);

    const linkWrongTx = await fetch(`${BASE_URL}/api/auth/oauth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkToken, tx: 'ffffffffffffffffffffffffffffffff', password: 'victim-password' }),
    });
    assert.equal(linkWrongTx.status, 401);

    const linkOk = await fetch(`${BASE_URL}/api/auth/oauth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkToken, tx, password: 'victim-password' }),
    });
    assert.equal(linkOk.status, 200);
  });
});
