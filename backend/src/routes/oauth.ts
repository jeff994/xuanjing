import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
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
  oauthProvider: OAuthProvider;
  nonce: string;
  next: string;
}

const VALID_PROVIDERS = new Set<OAuthProvider>(['google', 'wechat', 'facebook']);

function isValidProvider(value: string): value is OAuthProvider {
  return VALID_PROVIDERS.has(value as OAuthProvider);
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
    name?: string;
    picture?: string;
  };

  if (!profileRes.ok || !profile.sub) {
    throw new Error('Failed to fetch Google user profile');
  }

  return {
    provider: 'google',
    providerUserId: profile.sub,
    email: profile.email?.trim().toLowerCase() || null,
    displayName: profile.name?.trim() || profile.email?.split('@')[0] || 'Google User',
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

async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<{ id: number; username: string; email: string }> {
  // 1. Existing linked OAuth account
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
        id: Number(userRow.id),
        username: userRow.username as string,
        email: userRow.email as string,
      };
    }
  }

  // 2. Match existing user by email if the provider returned one
  let userRow = profile.email ? await db('users').where({ email: profile.email }).first() : undefined;

  // 3. Otherwise create a new user account
  if (!userRow) {
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
    userRow = { id: userId, username, email };
  }

  await db('oauth_accounts').insert({
    user_id: Number(userRow.id),
    provider: profile.provider,
    provider_user_id: profile.providerUserId,
    email: profile.email,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
  });

  return {
    id: Number(userRow.id),
    username: userRow.username as string,
    email: userRow.email as string,
  };
}

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  // Report which OAuth providers are configured on the backend
  app.get('/api/auth/providers', async () => {
    return {
      providers: [
        { id: 'google', name: 'Google (Gmail)', enabled: isProviderConfigured('google') },
        { id: 'wechat', name: 'WeChat', enabled: isProviderConfigured('wechat') },
        { id: 'facebook', name: 'Facebook', enabled: isProviderConfigured('facebook') },
      ],
    };
  });

  // Start stateless OAuth 2.0 redirect
  app.get('/api/auth/oauth/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const { next } = request.query as { next?: string };

    if (!isValidProvider(provider)) {
      return reply.code(400).send({ error: `Unsupported OAuth provider: ${provider}` });
    }

    if (!isProviderConfigured(provider)) {
      const msg = encodeURIComponent(`${provider} login is not configured on the server yet. Set its OAuth credentials in backend/.env.`);
      return reply.redirect(`${config.frontendUrl}/login?error=${msg}`);
    }

    // Stateless signed JWT state token — safe across multiple load-balanced API replicas
    const state = app.jwt.sign(
      {
        oauthProvider: provider,
        nonce: crypto.randomUUID(),
        next: sanitizeNextPath(next),
      } as unknown as Parameters<typeof app.jwt.sign>[0],
      { expiresIn: '10m' }
    );

    const authorizeUrl = buildAuthorizeUrl(provider, state);
    return reply.redirect(authorizeUrl);
  });

  // OAuth 2.0 callback handler
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

    if (statePayload.oauthProvider !== provider) {
      return redirectWithError('OAuth provider mismatch');
    }

    try {
      const profile =
        provider === 'google'
          ? await exchangeGoogleProfile(code)
          : provider === 'wechat'
            ? await exchangeWeChatProfile(code)
            : await exchangeFacebookProfile(code);

      const user = await findOrCreateOAuthUser(profile);
      const token = app.jwt.sign(user);
      const next = sanitizeNextPath(statePayload.next);

      // Pass JWT via URL fragment (#) so it is never sent to servers or Referer headers
      const fragment = new URLSearchParams({ token, next }).toString();
      return reply.redirect(`${config.frontendUrl}/oauth/callback#${fragment}`);
    } catch (err) {
      app.log.error(err, `OAuth callback failed for ${provider}`);
      const message = err instanceof Error ? err.message : `${provider} sign-in failed`;
      return redirectWithError(message);
    }
  });
}
