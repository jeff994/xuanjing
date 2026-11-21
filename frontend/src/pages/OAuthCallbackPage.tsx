import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { OAUTH_TX_STORAGE_KEY } from '../components/SocialLoginButtons';
import { useAuth } from '../context/AuthContext';

export function OAuthCallbackPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoking the effect after consuming sessionStorage
    if (startedRef.current) return;
    startedRef.current = true;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const exchangeToken = params.get('exchange');

    // Clear token from the browser URL bar immediately
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const tx = sessionStorage.getItem(OAUTH_TX_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_TX_STORAGE_KEY);

    if (!exchangeToken || !tx) {
      setError(
        'This sign-in callback did not match a login started in this browser tab. Please initiate sign-in from the Sign in page.'
      );
      return;
    }

    api
      .exchangeOAuthToken({ exchangeToken, tx })
      .then(async (res) => {
        await loginWithToken(res.token);
        navigate(res.next.startsWith('/') ? res.next : '/', { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to complete sign-in.');
      });
  }, [loginWithToken, navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">Sign-in failed</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      Completing sign-in...
    </div>
  );
}
