import { ShieldAlert } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { OAUTH_TX_STORAGE_KEY } from '../components/SocialLoginButtons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n/translations';

const PROVIDER_KEYS: Record<string, TranslationKey> = {
  google: 'provider.google',
  wechat: 'provider.wechat',
  facebook: 'provider.facebook',
};

export function OAuthLinkPage() {
  const { user, loginWithToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  const [linkToken, setLinkToken] = useState('');
  const [tx, setTx] = useState('');
  const [provider, setProvider] = useState('');
  const [email, setEmail] = useState('');
  const [hasPassword, setHasPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const token = params.get('linkToken') ?? '';
    const prov = params.get('provider') ?? '';
    const mail = params.get('email') ?? '';
    const hasPwd = params.get('hasPassword') !== '0';

    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const storedTx = sessionStorage.getItem(OAUTH_TX_STORAGE_KEY) ?? '';
    sessionStorage.removeItem(OAUTH_TX_STORAGE_KEY);

    if (!token || !storedTx) {
      setError(t('oauthLink.txMismatch'));
      return;
    }

    setLinkToken(token);
    setTx(storedTx);
    setProvider(prov);
    setEmail(mail);
    setHasPassword(hasPwd);
  }, [t]);

  const providerLabel = provider in PROVIDER_KEYS ? t(PROVIDER_KEYS[provider]) : provider;
  const isSignedInAsSameEmail = Boolean(user && email && user.email.toLowerCase() === email.toLowerCase());

  const handleConfirmLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!linkToken || !tx) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await api.linkOAuthAccount(
        isSignedInAsSameEmail ? { linkToken, tx } : { linkToken, tx, password }
      );
      await loginWithToken(res.token);
      navigate(res.next.startsWith('/') ? res.next : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('oauthLink.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('oauthLink.title')}</h1>
            <p className="text-xs text-slate-500">{t('oauthLink.subtitle')}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          {t('oauthLink.description', {
            email: email || '-',
            provider: providerLabel || 'OAuth',
          })}
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {linkToken && tx && isSignedInAsSameEmail ? (
          <form onSubmit={handleConfirmLink} className="mt-6 space-y-4">
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {t('oauthLink.signedInAs', { email: user?.email ?? '', provider: providerLabel })}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? t('oauthLink.linking') : t('oauthLink.linkButton', { provider: providerLabel })}
            </button>
          </form>
        ) : linkToken && tx && hasPassword ? (
          <form onSubmit={handleConfirmLink} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('oauthLink.existingPassword')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('oauthLink.passwordPlaceholder')}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? t('oauthLink.verifying') : t('oauthLink.verifyAndLink', { provider: providerLabel })}
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            {t('oauthLink.restartHint')}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            {t('oauth.backToSignIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
