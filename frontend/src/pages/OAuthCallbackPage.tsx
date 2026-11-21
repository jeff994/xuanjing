import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { OAUTH_TX_STORAGE_KEY } from '../components/SocialLoginButtons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function OAuthCallbackPage() {
  const { loginWithToken } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const exchangeToken = params.get('exchange');

    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const tx = sessionStorage.getItem(OAUTH_TX_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_TX_STORAGE_KEY);

    if (!exchangeToken || !tx) {
      setError(t('oauth.txMismatch'));
      return;
    }

    api
      .exchangeOAuthToken({ exchangeToken, tx })
      .then(async (res) => {
        await loginWithToken(res.token);
        navigate(res.next.startsWith('/') ? res.next : '/', { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('oauth.failedDefault'));
      });
  }, [loginWithToken, navigate, t]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">{t('oauth.failedTitle')}</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t('oauth.backToSignIn')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      {t('oauth.completing')}
    </div>
  );
}
