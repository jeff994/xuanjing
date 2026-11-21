import { FileText, Image as ImageIcon, Upload } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export function UploadBookPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bookFile) {
      setError(t('upload.selectFileError'));
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', author.trim());
      formData.append('description', description.trim());
      formData.append('bookFile', bookFile);
      if (coverFile) {
        formData.append('coverFile', coverFile);
      }

      const res = await api.uploadBook(formData);
      navigate(`/books/${res.book.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('upload.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('upload.subtitle')}</p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('upload.bookTitle')}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('upload.bookTitlePlaceholder')}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('upload.author')}</label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={t('upload.authorPlaceholder')}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('upload.description')}</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('upload.descriptionPlaceholder')}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('upload.bookFile')}</label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50/40">
              <FileText className="h-5 w-5 text-indigo-500" />
              <span>{bookFile ? bookFile.name : t('upload.bookFilePlaceholder')}</span>
              <input
                type="file"
                accept=".pdf,.epub,.txt,.md,.mobi"
                onChange={(e) => setBookFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('upload.coverFile')}</label>
            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50/40">
              <ImageIcon className="h-5 w-5 text-slate-400" />
              <span>{coverFile ? coverFile.name : t('upload.coverFilePlaceholder')}</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? t('upload.uploading') : t('upload.publish')}
          </button>
        </form>
      </div>
    </div>
  );
}
