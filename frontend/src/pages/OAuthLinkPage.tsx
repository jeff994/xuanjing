import { ShieldAlert } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google (Gmail)',
  wechat: 'WeChat',
  facebook: 'Facebook',
};

export function OAuthLinkPage() {
  const { user, loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [linkToken, setLinkToken] = useState('');
  const [provider, setProvider] = useState('');
  const [email, setEmail] = useState('');
  const [hasPassword, setHasPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const token = params.get('linkToken') ?? '';
    const prov = params.get('provider') ?? '';
    const mail = params.get('email') ?? '';
    const hasPwd = params.get('hasPassword') !== '0';

    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (!token) {
      setError('Missing or expired account linking session. Please sign in again.');
      return;
    }

    setLinkToken(token);
    setProvider(prov);
    setEmail(mail);
    setHasPassword(hasPwd);
  }, []);

  const providerLabel = PROVIDER_LABELS[provider] ?? provider;
  const isSignedInAsSameEmail = Boolean(user && email && user.email.toLowerCase() === email.toLowerCase());

  const handleConfirmLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!linkToken) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await api.linkOAuthAccount(
        isSignedInAsSameEmail ? { linkToken } : { linkToken, password }
      );
      await loginWithToken(res.token);
      navigate(res.next.startsWith('/') ? res.next : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify ownership and link account');
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
            <h1 className="text-xl font-bold text-slate-900">Verify Account Ownership</h1>
            <p className="text-xs text-slate-500">Additional verification required before linking</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          An account with <strong className="text-slate-900">{email || 'this email'}</strong> already exists. To
          protect your account, please verify ownership before linking your{' '}
          <strong className="text-slate-900">{providerLabel || 'social'}</strong> login.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {linkToken && isSignedInAsSameEmail ? (
          <form onSubmit={handleConfirmLink} className="mt-6 space-y-4">
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              You are currently signed in as <strong>{user?.email}</strong>. Click below to link{' '}
              <strong>{providerLabel}</strong> to this account.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Linking...' : `Link ${providerLabel} Account`}
            </button>
          </form>
        ) : linkToken && hasPassword ? (
          <form onSubmit={handleConfirmLink} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Existing Account Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your BookShelf password"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Verifying...' : `Verify & Link ${providerLabel}`}
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            This email is already registered via another sign-in provider without a password. Please sign in with your
            original provider first to confirm ownership.
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Back to Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
