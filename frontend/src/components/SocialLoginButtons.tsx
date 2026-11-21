import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { OAuthProviderInfo } from '../types';

interface SocialLoginButtonsProps {
  next?: string;
}

const DEFAULT_PROVIDERS: OAuthProviderInfo[] = [
  { id: 'google', name: 'Google (Gmail)', enabled: false },
  { id: 'wechat', name: 'WeChat', enabled: false },
  { id: 'facebook', name: 'Facebook', enabled: false },
];

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.85z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3a7.17 7.17 0 0 1-10.67-3.77H1.39v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.39 14.33A7.2 7.2 0 0 1 5.01 12c0-.81.14-1.6.38-2.33V6.58H1.39A12 12 0 0 0 0 12c0 1.94.46 3.77 1.39 5.42l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.39 6.58l4 3.09A7.16 7.16 0 0 1 12 4.75z"
      />
    </svg>
  );
}

function WeChatIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.69 4C4.45 4 1 6.95 1 10.6c0 2.08 1.13 3.94 2.9 5.15l-.72 2.18 2.53-1.27c.94.28 1.94.43 2.98.43.3 0 .6-.02.89-.05a5.9 5.9 0 0 1-.27-1.76c0-3.36 3.12-6.08 6.97-6.08.35 0 .69.03 1.03.07C16.64 6.23 13.04 4 8.69 4zm-2.5 5.4a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1zm5 0a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1z" />
      <path d="M16.28 10.2c-3.44 0-6.22 2.34-6.22 5.23 0 2.89 2.78 5.23 6.22 5.23.77 0 1.51-.12 2.19-.34l2.03 1.02-.58-1.76c1.56-.97 2.58-2.47 2.58-4.15 0-2.89-2.78-5.23-6.22-5.23zm-2.06 4.43a.88.88 0 1 1 0-1.76.88.88 0 0 1 0 1.76zm4.12 0a.88.88 0 1 1 0-1.76.88.88 0 0 1 0 1.76z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

export const OAUTH_TX_STORAGE_KEY = 'book_portal_oauth_tx';

function createOAuthTransactionId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function SocialLoginButtons({ next = '/' }: SocialLoginButtonsProps) {
  const [providers, setProviders] = useState<OAuthProviderInfo[]>(DEFAULT_PROVIDERS);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api
      .listAuthProviders()
      .then((res) => setProviders(res.providers))
      .catch(() => undefined);
  }, []);

  const handleClick = (provider: OAuthProviderInfo) => {
    setNotice('');
    if (!provider.enabled) {
      const envHint =
        provider.id === 'google'
          ? 'GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET'
          : provider.id === 'wechat'
            ? 'WECHAT_APP_ID & WECHAT_APP_SECRET'
            : 'FACEBOOK_APP_ID & FACEBOOK_APP_SECRET';
      setNotice(`${provider.name} login is ready — add ${envHint} in backend/.env to enable it.`);
      return;
    }

    const tx = createOAuthTransactionId();
    sessionStorage.setItem(OAUTH_TX_STORAGE_KEY, tx);

    const query = new URLSearchParams({ next, tx }).toString();
    window.location.href = `/api/auth/oauth/${provider.id}?${query}`;
  };

  const buttonStyles: Record<OAuthProviderInfo['id'], string> = {
    google: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    wechat: 'bg-[#07C160] text-white hover:bg-[#06ad56]',
    facebook: 'bg-[#1877F2] text-white hover:bg-[#166fe5]',
  };

  const renderIcon = (id: OAuthProviderInfo['id']) => {
    if (id === 'google') return <GoogleIcon />;
    if (id === 'wechat') return <WeChatIcon />;
    return <FacebookIcon />;
  };

  return (
    <div className="mt-6">
      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-slate-200" />
        <span className="bg-white px-3 text-xs font-medium uppercase tracking-wider text-slate-400">
          or continue with
        </span>
        <div className="w-full border-t border-slate-200" />
      </div>

      {notice && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          {notice}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleClick(provider)}
            className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition ${buttonStyles[provider.id]}`}
          >
            {renderIcon(provider.id)}
            <span>Continue with {provider.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
