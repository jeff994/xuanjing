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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <BookOpen className="h-5 w-5" />
          </span>
          <span>{t('nav.brand')}</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link
                to="/upload"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{t('nav.uploadBook')}</span>
              </Link>
              <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 md:flex">
                <UserIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span className="font-medium">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{t('nav.signOut')}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <LogIn className="h-4 w-4" />
                <span>{t('nav.signIn')}</span>
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
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
