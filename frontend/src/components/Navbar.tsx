import { BookOpen, LogIn, LogOut, Upload, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:px-6 sm:py-0">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>{t('nav.brand')}</span>
        </Link>

        {/* On narrow mobile (< sm), keep language selector on row 1 alongside brand; on sm+, place it inline before actions */}
        <div className="sm:order-2 sm:ml-auto">
          <LanguageSwitcher />
        </div>

        <nav className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2 sm:order-3 sm:w-auto sm:flex-nowrap sm:gap-3 sm:border-t-0 sm:pt-0">
          {user ? (
            <>
              <Link
                to="/upload"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{t('nav.uploadBook')}</span>
              </Link>
              <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 md:flex">
                <UserIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="font-medium">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{t('nav.signOut')}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>{t('nav.signIn')}</span>
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                {t('nav.createAccount')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
