import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/index.js';

export type OAuthProvider = 'google' | 'wechat' | 'facebook';

interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface OAuthStatePayload {
  purpose: 'oauth_state';
  oauthProvider: OAuthProvider;
  tx: string;
  nonce: string;
  next: string;
}

interface OAuthExchangePayload {
  purpose: 'oauth_exchange';
  userId: number;
  tx: string;
  next: string;
}

interface OAuthLinkTokenPayload {
  purpose: 'oauth_link';
  profile: OAuthProfile;
  tx: string;
  next: string;
}

const VALID_PROVIDERS = new Set<OAuthProvider>(['google', 'wechat', 'facebook']);

const exchangeSchema = z.object({
  exchangeToken: z.string().min(1, 'Missing exchange token'),
  tx: z.string().min(16, 'Missing browser transaction token').max(128),
});

const linkAccountSchema = z.object({
  linkToken: z.string().min(1, 'Missing link token'),
  tx: z.string().min(16, 'Missing browser transaction token').max(128),
  password: z.string().min(1).optional(),
});

function isValidProvider(value: string): value is OAuthProvider {
  return VALID_PROVIDERS.has(value as OAuthProvider);
}

function isValidTx(value?: string): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === 'google') {
    return Boolean(config.oauth.google.clientId && config.oauth.google.clientSecret);
  }
  if (provider === 'wechat') {
    return Boolean(config.oauth.wechat.appId && config.oauth.wechat.appSecret);
  }
  return Boolean(config.oauth.facebook.appId && config.oauth.facebook.appSecret);
}

function getCallbackUrl(provider: OAuthProvider): string {
  return `${config.apiPublicUrl}/api/auth/oauth/${provider}/callback`;
}

function sanitizeNextPath(next?: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }
  return next;
}

function buildAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const redirectUri = getCallbackUrl(provider);

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (provider === 'wechat') {
    const params = new URLSearchParams({
      appid: config.oauth.wechat.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'snsapi_login',
      state,
    });
    return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
  }

  const params = new URLSearchParams({
    client_id: config.oauth.facebook.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

async function exchangeGoogleProfile(code: string): Promise<OAuthProfile> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: getCallbackUrl('google'),
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed');
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profileRes.ok || !profile.sub) {
    throw new Error('Failed to fetch Google user profile');
  }

  const verifiedEmail = profile.email_verified === true ? profile.email?.trim().toLowerCase() || null : null;

  return {
    provider: 'google',
    providerUserId: profile.sub,
    email: verifiedEmail,
    displayName: profile.name?.trim() || verifiedEmail?.split('@')[0] || 'Google User',
    avatarUrl: profile.picture || null,
  };
}

async function exchangeWeChatProfile(code: string): Promise<OAuthProfile> {
  const tokenParams = new URLSearchParams({
    appid: config.oauth.wechat.appId,
    secret: config.oauth.wechat.appSecret,
    code,
    grant_type: 'authorization_code',
  });
  const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${tokenParams.toString()}`);
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    openid?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!tokenRes.ok || tokenData.errcode || !tokenData.access_token || !tokenData.openid) {
    throw new Error(tokenData.errmsg || 'WeChat token exchange failed');
  }

  const userParams = new URLSearchParams({
    access_token: tokenData.access_token,
    openid: tokenData.openid,
    lang: 'en',
  });
  const profileRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?${userParams.toString()}`);
  const profile = (await profileRes.json()) as {
    openid?: string;
    unionid?: string;
    nickname?: string;
    headimgurl?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!profileRes.ok || profile.errcode) {
    throw new Error(profile.errmsg || 'Failed to fetch WeChat user profile');
  }

  const providerUserId = profile.unionid || tokenData.unionid || profile.openid || tokenData.openid;

  return {
    provider: 'wechat',
    providerUserId,
    email: null,
    displayName: profile.nickname?.trim() || 'WeChat User',
    avatarUrl: profile.headimgurl || null,
  };
}

async function exchangeFacebookProfile(code: string): Promise<OAuthProfile> {
  const tokenParams = new URLSearchParams({
    client_id: config.oauth.facebook.appId,
    client_secret: config.oauth.facebook.appSecret,
    redirect_uri: getCallbackUrl('facebook'),
    code,
  });
  const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`);
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error?.message || 'Facebook token exchange failed');
  }

  const profileParams = new URLSearchParams({
    fields: 'id,name,email,picture.type(large)',
    access_token: tokenData.access_token,
  });
  const profileRes = await fetch(`https://graph.facebook.com/v21.0/me?${profileParams.toString()}`);
  const profile = (await profileRes.json()) as {
    id?: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
    error?: { message?: string };
  };

  if (!profileRes.ok || !profile.id) {
    throw new Error(profile.error?.message || 'Failed to fetch Facebook user profile');
  }

  return {
    provider: 'facebook',
    providerUserId: profile.id,
    email: profile.email?.trim().toLowerCase() || null,
    displayName: profile.name?.trim() || 'Facebook User',
    avatarUrl: profile.picture?.data?.url || null,
  };
}

function extractId(inserted: unknown): number {
  const first = Array.isArray(inserted) ? inserted[0] : inserted;
  if (typeof first === 'object' && first !== null && 'id' in first) {
    return Number((first as { id: number | string }).id);
  }
  return Number(first);
}

async function generateUniqueUsername(baseName: string): Promise<string> {
  const cleaned = baseName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);

  const base = cleaned.length >= 3 ? cleaned : `user_${crypto.randomBytes(3).toString('hex')}`;
  let candidate = base;

  for (let attempt = 0; attempt < 10; attempt++) {
    const exists = await db('users').where({ username: candidate }).first();
    if (!exists) return candidate;
    candidate = `${base.slice(0, 24)}_${crypto.randomBytes(2).toString('hex')}`;
  }

  return `user_${crypto.randomBytes(6).toString('hex')}`;
}

type OAuthResolveResult =
  | { status: 'authenticated'; user: { id: number; username: string; email: string } }
  | { status: 'link_required'; hasPassword: boolean };

async function resolveOAuthUser(profile: OAuthProfile): Promise<OAuthResolveResult> {
  const existingLink = await db('oauth_accounts')
    .where({ provider: profile.provider, provider_user_id: profile.providerUserId })
    .first();

  if (existingLink) {
    const userRow = await db('users').where({ id: existingLink.user_id }).first();
    if (userRow) {
      await db('oauth_accounts')
        .where({ id: existingLink.id })
        .update({
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
          email: profile.email,
        });
      return {
        status: 'authenticated',
        user: {
          id: Number(userRow.id),
          username: userRow.username as string,
          email: userRow.email as string,
        },
      };
    }
  }

  // Never auto-link to an existing email account without explicit ownership proof
  if (profile.email) {
    const existingEmailUser = await db('users').where({ email: profile.email }).first();
    if (existingEmailUser) {
      const hasPassword =
        typeof existingEmailUser.password_hash === 'string' && !existingEmailUser.password_hash.startsWith('oauth:');
      return { status: 'link_required', hasPassword };
    }
  }

  const username = await generateUniqueUsername(profile.displayName || profile.email?.split('@')[0] || profile.provider);
  const email =
    profile.email ||
    `${profile.provider}_${crypto.createHash('sha256').update(profile.providerUserId).digest('hex').slice(0, 16)}@oauth.local`;

  const inserted = await db('users')
    .insert({
      username,
      email,
      password_hash: `oauth:${profile.provider}:${crypto.randomUUID()}`,
    })
    .returning('id');

  const userId = extractId(inserted);

  await db('oauth_accounts').insert({
    user_id: userId,
    provider: profile.provider,
    provider_user_id: profile.providerUserId,
    email: profile.email,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
  });

  return {
    status: 'authenticated',
    user: { id: userId, username, email },
  };
}

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/providers', async () => {
    return {
      providers: [
        { id: 'google', name: 'Google (Gmail)', enabled: isProviderConfigured('google') },
        { id: 'wechat', name: 'WeChat', enabled: isProviderConfigured('wechat') },
        { id: 'facebook', name: 'Facebook', enabled: isProviderConfigured('facebook') },
      ],
    };
  });

  // Start browser-bound, stateless OAuth 2.0 redirect
  app.get('/api/auth/oauth/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const { next, tx } = request.query as { next?: string; tx?: string };

    if (!isValidProvider(provider)) {
      return reply.code(400).send({ error: `Unsupported OAuth provider: ${provider}` });
    }

    if (!isValidTx(tx)) {
      const msg = encodeURIComponent('Invalid login transaction. Please start sign-in from the login page.');
      return reply.redirect(`${config.frontendUrl}/login?error=${msg}`);
    }

    if (!isProviderConfigured(provider)) {
      const msg = encodeURIComponent(`${provider} login is not configured on the server yet. Set its OAuth credentials in backend/.env.`);
      return reply.redirect(`${config.frontendUrl}/login?error=${msg}`);
    }

    const state = app.jwt.sign(
      {
        purpose: 'oauth_state',
        oauthProvider: provider,
        tx,
        nonce: crypto.randomUUID(),
        next: sanitizeNextPath(next),
      } as unknown as Parameters<typeof app.jwt.sign>[0],
      { expiresIn: '10m' }
    );

    const authorizeUrl = buildAuthorizeUrl(provider, state);
    return reply.redirect(authorizeUrl);
  });

  // OAuth 2.0 callback handler — binds result to the initiating browser's `tx` nonce
  app.get('/api/auth/oauth/:provider/callback', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    const redirectWithError = (message: string) =>
      reply.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(message)}`);

    if (!isValidProvider(provider)) {
      return redirectWithError(`Unsupported OAuth provider: ${provider}`);
    }

    if (error) {
      return redirectWithError(error_description || `OAuth sign-in cancelled or failed (${error})`);
    }

    if (!code || !state) {
      return redirectWithError('Missing OAuth authorization code or state parameter');
    }

    let statePayload: OAuthStatePayload;
    try {
      statePayload = app.jwt.verify<OAuthStatePayload>(state);
    } catch {
      return redirectWithError('OAuth session expired or invalid state. Please try signing in again.');
    }

    if (statePayload.purpose !== 'oauth_state' || statePayload.oauthProvider !== provider || !isValidTx(statePayload.tx)) {
      return redirectWithError('OAuth provider or transaction mismatch');
    }

    try {
      const profile =
        provider === 'google'
          ? await exchangeGoogleProfile(code)
          : provider === 'wechat'
            ? await exchangeWeChatProfile(code)
            : await exchangeFacebookProfile(code);

      const resolved = await resolveOAuthUser(profile);
      const next = sanitizeNextPath(statePayload.next);

      if (resolved.status === 'link_required') {
        const linkToken = app.jwt.sign(
          {
            purpose: 'oauth_link',
            profile,
            tx: statePayload.tx,
            next,
          } as unknown as Parameters<typeof app.jwt.sign>[0],
          { expiresIn: '10m' }
        );

        const fragment = new URLSearchParams({
          linkToken,
          provider: profile.provider,
          email: profile.email ?? '',
          hasPassword: resolved.hasPassword ? '1' : '0',
        }).toString();

        return reply.redirect(`${config.frontendUrl}/oauth/link#${fragment}`);
      }

      // Issue a short-lived, browser-bound exchange token (never a raw session JWT in the URL)
      const exchangeToken = app.jwt.sign(
        {
          purpose: 'oauth_exchange',
          userId: resolved.user.id,
          tx: statePayload.tx,
          next,
        } as unknown as Parameters<typeof app.jwt.sign>[0],
        { expiresIn: '2m' }
      );

      const fragment = new URLSearchParams({ exchange: exchangeToken }).toString();
      return reply.redirect(`${config.frontendUrl}/oauth/callback#${fragment}`);
    } catch (err) {
      app.log.error(err, `OAuth callback failed for ${provider}`);
      const message = err instanceof Error ? err.message : `${provider} sign-in failed`;
      return redirectWithError(message);
    }
  });

  // Exchange a browser-bound `oauth_exchange` token + matching `tx` nonce for a real session JWT
  app.post('/api/auth/oauth/exchange', async (request, reply) => {
    const parsed = exchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid exchange request' });
    }

    let payload: OAuthExchangePayload;
    try {
      payload = app.jwt.verify<OAuthExchangePayload>(parsed.data.exchangeToken);
    } catch {
      return reply.code(401).send({ error: 'OAuth sign-in token expired or invalid. Please sign in again.' });
    }

    if (
      payload.purpose !== 'oauth_exchange' ||
      typeof payload.userId !== 'number' ||
      !isValidTx(payload.tx) ||
      !timingSafeMatch(payload.tx, parsed.data.tx)
    ) {
      return reply.code(401).send({
        error: 'This sign-in link does not match your browser session. Please initiate sign-in from this browser.',
      });
    }

    const userRow = await db('users').where({ id: payload.userId }).first();
    if (!userRow) {
      return reply.code(404).send({ error: 'User account not found' });
    }

    const user = {
      id: Number(userRow.id),
      username: userRow.username as string,
      email: userRow.email as string,
    };
    const token = app.jwt.sign(user);

    return reply.send({ user, token, next: sanitizeNextPath(payload.next) });
  });

  // Explicit ownership-verified + browser-bound linking endpoint
  app.post('/api/auth/oauth/link', async (request, reply) => {
    const parsed = linkAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    }

    let payload: OAuthLinkTokenPayload;
    try {
      payload = app.jwt.verify<OAuthLinkTokenPayload>(parsed.data.linkToken);
    } catch {
      return reply.code(400).send({ error: 'Link session expired or invalid. Please sign in with your provider again.' });
    }

    if (
      payload.purpose !== 'oauth_link' ||
      !payload.profile?.email ||
      !isValidProvider(payload.profile.provider) ||
      !isValidTx(payload.tx) ||
      !timingSafeMatch(payload.tx, parsed.data.tx)
    ) {
      return reply.code(401).send({
        error: 'This linking request does not match your browser session. Please sign in again.',
      });
    }

    const existingUser = await db('users').where({ email: payload.profile.email }).first();
    if (!existingUser) {
      return reply.code(404).send({ error: 'Account no longer exists. Please try signing in again.' });
    }

    let ownershipVerified = false;

    if (request.headers.authorization?.startsWith('Bearer ')) {
      try {
        await request.jwtVerify();
        const jwtUser = request.user as { id?: number; purpose?: string };
        if (!jwtUser.purpose && jwtUser.id === Number(existingUser.id)) {
          ownershipVerified = true;
        }
      } catch {
        // Fall through to password check if provided
      }
    }

    if (!ownershipVerified && parsed.data.password) {
      const hasPassword =
        typeof existingUser.password_hash === 'string' && !existingUser.password_hash.startsWith('oauth:');
      if (hasPassword && (await bcrypt.compare(parsed.data.password, existingUser.password_hash))) {
        ownershipVerified = true;
      }
    }

    if (!ownershipVerified) {
      return reply.code(401).send({
        error: 'Ownership verification failed. Please enter the correct password for the existing account.',
      });
    }

    const existingLink = await db('oauth_accounts')
      .where({
        provider: payload.profile.provider,
        provider_user_id: payload.profile.providerUserId,
      })
      .first();

    if (existingLink && Number(existingLink.user_id) !== Number(existingUser.id)) {
      return reply.code(409).send({ error: 'This social account is already linked to another user.' });
    }

    if (!existingLink) {
      await db('oauth_accounts').insert({
        user_id: Number(existingUser.id),
        provider: payload.profile.provider,
        provider_user_id: payload.profile.providerUserId,
        email: payload.profile.email,
        display_name: payload.profile.displayName,
        avatar_url: payload.profile.avatarUrl,
      });
    }

    const user = {
      id: Number(existingUser.id),
      username: existingUser.username as string,
      email: existingUser.email as string,
    };
    const token = app.jwt.sign(user);

    return reply.send({ user, token, next: sanitizeNextPath(payload.next) });
  });
}
