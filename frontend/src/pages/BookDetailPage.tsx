import { ArrowLeft, BookText, Calendar, Download, MessageSquare, Send, Trash2, User } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Book, Comment } from '../types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const bookId = Number(id);

  useEffect(() => {
    if (!Number.isInteger(bookId) || bookId <= 0) {
      setError('Invalid book ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([api.getBook(bookId), api.listComments(bookId)])
      .then(([bookRes, commentsRes]) => {
        setBook(bookRes.book);
        setComments(commentsRes.comments);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load book');
      })
      .finally(() => setLoading(false));
  }, [bookId]);

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !book) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await api.addComment(book.id, newComment.trim());
      setComments((prev) => [res.comment, ...prev]);
      setNewComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const handleDeleteBook = async () => {
    if (!book || !window.confirm(`Delete "${book.title}" permanently?`)) return;
    try {
      await api.deleteBook(book.id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete book');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-slate-500">
        Loading book details...
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <p className="text-red-600">{error || 'Book not found'}</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to library
        </Link>
      </div>
    );
  }

  const isOwner = user && user.id === book.uploadedBy;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600">
        <ArrowLeft className="h-4 w-4" />
        Back to library
      </Link>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Book Info Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="flex items-center justify-center bg-slate-100 md:col-span-1">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="h-full max-h-80 w-full object-cover" />
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white md:h-full">
                <BookText className="mb-3 h-12 w-12 opacity-90" />
                <span className="text-center text-sm font-semibold">{book.fileName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col p-6 md:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{book.title}</h1>
                <p className="mt-1 text-base text-slate-600">by {book.author}</p>
              </div>
              {isOwner && (
                <button
                  onClick={handleDeleteBook}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Uploaded by <strong className="text-slate-700">{book.uploaderUsername}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(book.createdAt)}
              </span>
              <span>
                {book.fileName} ({formatSize(book.fileSize)})
              </span>
            </div>

            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {book.description || 'No description provided for this book.'}
            </p>

            <div className="mt-6 flex items-center gap-3 pt-4">
              <a
                href={book.downloadUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Download className="h-4 w-4" />
                Download Book
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          Comments ({comments.length})
        </h2>

        {user ? (
          <form onSubmit={handleAddComment} className="mt-4">
            <textarea
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts or review about this book..."
              required
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <Link to="/login" className="font-medium text-indigo-600 hover:underline">
              Sign in
            </Link>{' '}
            or{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:underline">
              create an account
            </Link>{' '}
            to leave a comment on this book.
          </div>
        )}

        <div className="mt-6 divide-y divide-slate-100">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No comments yet. Start the discussion!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{comment.username}</span>
                    <span className="text-xs text-slate-400">• {formatDate(comment.createdAt)}</span>
                  </div>
                  {user && user.id === comment.userId && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-xs text-slate-400 transition hover:text-red-600"
                      title="Delete comment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
