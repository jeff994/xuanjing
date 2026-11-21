import { BookOpen, BookText, MessageSquare, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Book } from '../types';

const COVER_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BookCard({ book }: { book: Book }) {
  const { t } = useLanguage();
  const gradient = COVER_GRADIENTS[book.id % COVER_GRADIENTS.length];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/books/${book.id}/read`} className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-6 text-white`}>
            <BookText className="mb-2 h-10 w-10 opacity-90" aria-hidden="true" />
            <span className="line-clamp-2 text-center text-sm font-semibold opacity-95">{book.title}</span>
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-slate-900/75 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur">
          {formatSize(book.fileSize)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/books/${book.id}/read`} className="block">
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900 group-hover:text-indigo-600">
            {book.title}
          </h3>
        </Link>
        <p className="mt-0.5 text-sm text-slate-600">{t('common.byAuthor', { author: book.author })}</p>

        {book.description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{book.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 truncate">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{book.uploaderUsername}</span>
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              to={`/books/${book.id}`}
              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-indigo-600"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {t(book.commentCount === 1 ? 'common.commentSingular' : 'common.commentPlural', {
                count: book.commentCount,
              })}
            </Link>
            <Link
              to={`/books/${book.id}/read`}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 transition hover:bg-indigo-100"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {t('book.read')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
