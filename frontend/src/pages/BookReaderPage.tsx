import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Square,
} from 'lucide-react';
import { FormEvent, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Book } from '../types';
import { BookFormat, getBookFormat, paginateText } from '../utils/pagination';

type ReaderTheme = 'light' | 'sepia' | 'dark';
type PageLayout = 'single' | 'double';

const LAYOUT_STORAGE_KEY = 'book_portal_page_layout';

const THEME_CLASSES: Record<ReaderTheme, { page: string; surface: string; border: string; muted: string }> = {
  light: {
    page: 'bg-slate-100 text-slate-900',
    surface: 'bg-white text-slate-900',
    border: 'border-slate-200',
    muted: 'text-slate-500',
  },
  sepia: {
    page: 'bg-[#f4ecd8] text-[#3b2f1e]',
    surface: 'bg-[#fbf6ea] text-[#3b2f1e]',
    border: 'border-[#e4d5b7]',
    muted: 'text-[#7c694c]',
  },
  dark: {
    page: 'bg-slate-950 text-slate-100',
    surface: 'bg-slate-900 text-slate-100',
    border: 'border-slate-800',
    muted: 'text-slate-400',
  },
};

function progressKey(bookId: number): string {
  return `book_portal_progress_${bookId}`;
}

function readSavedPage(bookId: number): number {
  try {
    const raw = localStorage.getItem(progressKey(bookId));
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  } catch {
    return 1;
  }
}

function readSavedLayout(): PageLayout {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'double' ? 'double' : 'single';
  } catch {
    return 'single';
  }
}

function saveProgress(bookId: number, value: string | number): void {
  try {
    localStorage.setItem(progressKey(bookId), String(value));
  } catch {
    // Ignore storage errors
  }
}

interface TextReaderProps {
  book: Book;
  contentUrl: string;
  theme: ReaderTheme;
  fontSize: number;
  isFullscreen: boolean;
  pageLayout: PageLayout;
  onToggleLayout: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

function TextBookReader({
  book,
  contentUrl,
  theme,
  fontSize,
  isFullscreen,
  pageLayout,
  onToggleLayout,
  scrollContainerRef,
}: TextReaderProps) {
  const { t } = useLanguage();
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(() => readSavedPage(book.id));
  const [jumpValue, setJumpValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prevPageRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetch(contentUrl)
      .then((res) => {
        if (!res.ok) throw new Error(t('reader.loadError'));
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const nextPages = paginateText(text, 1800);
        setPages(nextPages);
        setCurrentPage((prev) => Math.min(Math.max(1, prev), nextPages.length));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('reader.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentUrl, t]);

  const totalPages = Math.max(1, pages.length);
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const isDouble = pageLayout === 'double';
  const step = isDouble ? 2 : 1;
  const hasRightPage = isDouble && safePage + 1 <= totalPages;
  const pageLabel = hasRightPage
    ? t('reader.pagesRangeOf', { start: safePage, end: safePage + 1, total: totalPages })
    : t('reader.pageOf', { current: safePage, total: totalPages });

  useEffect(() => {
    if (!loading && pages.length > 0) {
      saveProgress(book.id, safePage);
    }
  }, [book.id, safePage, loading, pages.length]);

  useEffect(() => {
    if (loading || pages.length === 0) return;
    if (prevPageRef.current !== null && prevPageRef.current !== safePage) {
      if (isFullscreen && scrollContainerRef.current) {
        if (typeof scrollContainerRef.current.scrollTo === 'function') {
          scrollContainerRef.current.scrollTo(0, 0);
        } else {
          scrollContainerRef.current.scrollTop = 0;
          scrollContainerRef.current.scrollLeft = 0;
        }
      } else if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
    }
    prevPageRef.current = safePage;
  }, [safePage, isFullscreen, loading, pages.length, scrollContainerRef]);

  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - step)), [step]);
  const goNext = useCallback(
    () => setCurrentPage((p) => (p + step <= totalPages ? p + step : p)),
    [step, totalPages]
  );

  const canGoNext = safePage + step <= totalPages;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext]);

  const handleJump = (e: FormEvent) => {
    e.preventDefault();
    const num = Number(jumpValue);
    if (Number.isInteger(num) && num >= 1 && num <= totalPages) {
      setCurrentPage(num);
      setJumpValue('');
    }
  };

  const styles = THEME_CLASSES[theme];

  if (loading) {
    return <div className={`py-20 text-center text-sm ${styles.muted}`}>{t('reader.loadingBook')}</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const renderSpread = (fullscreenMode: boolean) => (
    <div
      className={
        isDouble
          ? fullscreenMode
            ? `mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0 ${styles.border}`
            : `grid min-h-[62vh] grid-cols-1 divide-y rounded-2xl border shadow-sm md:grid-cols-2 md:divide-x md:divide-y-0 ${styles.surface} ${styles.border}`
          : fullscreenMode
            ? 'mx-auto min-h-screen max-w-4xl'
            : `min-h-[62vh] rounded-2xl border shadow-sm ${styles.surface} ${styles.border}`
      }
      style={{ fontSize: `${fontSize}px`, lineHeight: fullscreenMode ? 1.85 : 1.8 }}
    >
      <article className={fullscreenMode ? 'px-8 py-12 sm:px-14' : 'p-6 sm:p-10'}>
        <div className="whitespace-pre-wrap break-words font-serif">{pages[safePage - 1]}</div>
      </article>
      {isDouble && (
        <article className={fullscreenMode ? 'px-8 py-12 sm:px-14' : 'p-6 sm:p-10'}>
          <div className="whitespace-pre-wrap break-words font-serif">{hasRightPage ? pages[safePage] : ''}</div>
        </article>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className={`relative min-h-screen w-full ${styles.surface}`}>
        {renderSpread(true)}

        <button
          type="button"
          onClick={goPrev}
          disabled={safePage <= 1}
          aria-label={t('reader.prevPage')}
          className="fixed left-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-2.5 text-white opacity-20 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label={t('reader.nextPage')}
          className="fixed right-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-2.5 text-white opacity-20 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/75 px-4 py-1.5 text-xs font-medium text-white opacity-25 shadow-lg backdrop-blur transition hover:opacity-100">
          <span>{pageLabel}</span>
          <button
            type="button"
            onClick={onToggleLayout}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] hover:bg-white/25"
          >
            {isDouble ? t('reader.singlePage') : t('reader.doublePage')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto flex flex-col gap-4 ${isDouble ? 'max-w-6xl' : 'max-w-3xl'}`}>
      {renderSpread(false)}

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${styles.surface} ${styles.border}`}>
        <button
          type="button"
          onClick={goPrev}
          disabled={safePage <= 1}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t('reader.prevPage')}</span>
        </button>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">{pageLabel}</span>
          {totalPages > 1 && (
            <form onSubmit={handleJump} className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                aria-label={t('reader.jumpToPage')}
                placeholder={String(safePage)}
                className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>{t('reader.nextPage')}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className={`text-center text-xs ${styles.muted}`}>{t('reader.keyboardHint')}</p>
    </div>
  );
}

interface PdfReaderProps {
  book: Book;
  contentUrl: string;
  isFullscreen: boolean;
  pageLayout: PageLayout;
  onToggleLayout: () => void;
}

function PdfBookReader({ book, contentUrl, isFullscreen, pageLayout, onToggleLayout }: PdfReaderProps) {
  const { t } = useLanguage();
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const prevPageRef = useRef<number | null>(null);

  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => readSavedPage(book.id));
  const [scale, setScale] = useState(1.25);
  const [jumpValue, setJumpValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');

  const isDouble = pageLayout === 'double';
  const step = isDouble ? 2 : 1;
  const hasRightPage = isDouble && currentPage + 1 <= totalPages;
  const canGoNext = currentPage + step <= totalPages;
  const pageLabel = hasRightPage
    ? t('reader.pagesRangeOf', { start: currentPage, end: currentPage + 1, total: totalPages })
    : t('reader.pageOf', { current: currentPage, total: totalPages });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    import('pdfjs-dist')
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const loadingTask = pdfjs.getDocument({ url: contentUrl });
        const doc = await loadingTask.promise;
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }
        pdfDocRef.current = { doc, destroy: () => loadingTask.destroy() };
        setTotalPages(doc.numPages);
        setCurrentPage((prev) => Math.min(Math.max(1, prev), doc.numPages));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('reader.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [contentUrl, t]);

  useEffect(() => {
    const doc = pdfDocRef.current?.doc;
    const leftCanvas = leftCanvasRef.current;
    if (!doc || !leftCanvas || totalPages === 0) return;

    let cancelled = false;
    setRendering(true);
    saveProgress(book.id, currentPage);

    const renderPageToCanvas = async (pageNum: number, canvas: HTMLCanvasElement, columns: number) => {
      const page = (await doc.getPage(pageNum)) as {
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      };
      if (cancelled) return;

      const dpr = window.devicePixelRatio || 1;
      let effectiveScale = scale;

      if (isFullscreen) {
        const base = page.getViewport({ scale: 1 });
        const availWidth = columns === 2 ? (window.innerWidth - 12) / 2 : window.innerWidth;
        const fitScale = Math.min(availWidth / base.width, window.innerHeight / base.height);
        effectiveScale = Math.max(0.4, fitScale * (scale / 1.25));
      } else if (columns === 2) {
        effectiveScale = Math.max(0.5, scale * 0.72);
      }

      const viewport = page.getViewport({ scale: effectiveScale });
      const scaledViewport = page.getViewport({ scale: effectiveScale * dpr });

      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    };

    const columns = hasRightPage ? 2 : 1;
    const tasks: Promise<void>[] = [renderPageToCanvas(currentPage, leftCanvas, columns)];
    if (hasRightPage && rightCanvasRef.current) {
      tasks.push(renderPageToCanvas(currentPage + 1, rightCanvasRef.current, columns));
    }

    Promise.all(tasks)
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('reader.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [book.id, currentPage, scale, totalPages, isFullscreen, hasRightPage, t]);

  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - step)), [step]);
  const goNext = useCallback(
    () => setCurrentPage((p) => (p + step <= totalPages ? p + step : p)),
    [step, totalPages]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext]);

  const handleJump = (e: FormEvent) => {
    e.preventDefault();
    const num = Number(jumpValue);
    if (Number.isInteger(num) && num >= 1 && num <= totalPages) {
      setCurrentPage(num);
      setJumpValue('');
    }
  };

  useEffect(() => {
    if (loading || totalPages === 0) return;
    if (prevPageRef.current !== null && prevPageRef.current !== currentPage) {
      if (isFullscreen && fullscreenScrollRef.current) {
        if (typeof fullscreenScrollRef.current.scrollTo === 'function') {
          fullscreenScrollRef.current.scrollTo(0, 0);
        } else {
          fullscreenScrollRef.current.scrollTop = 0;
          fullscreenScrollRef.current.scrollLeft = 0;
        }
      } else if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
    }
    prevPageRef.current = currentPage;
  }, [currentPage, isFullscreen, loading, totalPages]);

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-500">{t('reader.loadingBook')}</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div ref={fullscreenScrollRef} className="relative flex h-screen w-screen overflow-auto bg-slate-950">
        {rendering && (
          <span className="fixed left-4 top-4 z-40 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-white">
            {t('reader.loadingPage')}
          </span>
        )}
        <div className="m-auto flex w-max shrink-0 items-center gap-2">
          <canvas ref={leftCanvasRef} className="block shrink-0 bg-white" />
          {hasRightPage && <canvas ref={rightCanvasRef} className="block shrink-0 bg-white" />}
        </div>

        <button
          type="button"
          onClick={goPrev}
          disabled={currentPage <= 1}
          aria-label={t('reader.prevPage')}
          className="fixed left-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-2.5 text-white opacity-20 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label={t('reader.nextPage')}
          className="fixed right-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-2.5 text-white opacity-20 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/75 px-3.5 py-1.5 text-xs font-medium text-white opacity-25 shadow-lg backdrop-blur transition hover:opacity-100">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(2))))}
            aria-label={t('reader.zoomOut')}
            className="rounded p-1 hover:bg-white/15"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span>{pageLabel}</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(2))))}
            aria-label={t('reader.zoomIn')}
            className="rounded p-1 hover:bg-white/15"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToggleLayout}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] hover:bg-white/25"
          >
            {isDouble ? t('reader.singlePage') : t('reader.doublePage')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto flex flex-col items-center gap-4 ${isDouble ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(2))))}
          aria-label={t('reader.zoomOut')}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-100"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="min-w-14 text-center text-xs font-medium text-slate-600">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.2).toFixed(2))))}
          aria-label={t('reader.zoomIn')}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-100"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-200/70 p-4 shadow-inner">
        {rendering && (
          <span className="absolute right-4 top-4 rounded-full bg-slate-900/75 px-3 py-1 text-xs text-white">
            {t('reader.loadingPage')}
          </span>
        )}
        <div className="mx-auto flex w-max shrink-0 items-start gap-3">
          <canvas ref={leftCanvasRef} className="shrink-0 rounded bg-white shadow-md" />
          {hasRightPage && <canvas ref={rightCanvasRef} className="shrink-0 rounded bg-white shadow-md" />}
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t('reader.prevPage')}</span>
        </button>

        <div className="flex items-center gap-3 text-sm text-slate-700">
          <span className="font-medium">{pageLabel}</span>
          {totalPages > 1 && (
            <form onSubmit={handleJump}>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                aria-label={t('reader.jumpToPage')}
                placeholder={String(currentPage)}
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm outline-none focus:border-indigo-500"
              />
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>{t('reader.nextPage')}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-center text-xs text-slate-500">{t('reader.keyboardHint')}</p>
    </div>
  );
}

interface EpubReaderProps {
  book: Book;
  contentUrl: string;
  fontSize: number;
  isFullscreen: boolean;
  pageLayout: PageLayout;
  onToggleLayout: () => void;
}

function EpubBookReader({ book, contentUrl, fontSize, isFullscreen, pageLayout, onToggleLayout }: EpubReaderProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isDouble = pageLayout === 'double';

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let epubBook: any = null;
    setLoading(true);
    setError('');

    Promise.all([
      import('epubjs'),
      fetch(contentUrl).then((res) => {
        if (!res.ok) throw new Error(t('reader.loadError'));
        return res.arrayBuffer();
      }),
    ])
      .then(async ([epubModule, arrayBuffer]) => {
        if (cancelled || !containerRef.current) return;
        const ePub = epubModule.default;
        epubBook = ePub(arrayBuffer);
        const rendition = epubBook.renderTo(containerRef.current, {
          width: '100%',
          height: isFullscreen ? '100vh' : '65vh',
          flow: 'paginated',
          spread: isDouble ? 'always' : 'none',
        });
        renditionRef.current = rendition;
        rendition.themes.fontSize(`${fontSize}px`);

        rendition.on('relocated', (location: { start?: { cfi?: string; displayed?: { page?: number } } }) => {
          if (location.start?.cfi) {
            saveProgress(book.id, location.start.cfi);
          }
          if (location.start?.displayed?.page) {
            setPageNumber(location.start.displayed.page);
          }
        });

        let savedCfi: string | undefined;
        try {
          const saved = localStorage.getItem(progressKey(book.id));
          if (saved && saved.startsWith('epubcfi(')) {
            savedCfi = saved;
          }
        } catch {
          // Ignore storage errors
        }

        await rendition.display(savedCfi);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('reader.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (epubBook) {
        epubBook.destroy();
      }
      renditionRef.current = null;
    };
  }, [book.id, contentUrl, isFullscreen, isDouble, t]);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}px`);
    }
  }, [fontSize]);

  const goPrev = useCallback(() => {
    void renditionRef.current?.prev();
  }, []);

  const goNext = useCallback(() => {
    void renditionRef.current?.next();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div className="relative h-screen w-screen bg-white">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-slate-500">
            {t('reader.loadingBook')}
          </div>
        )}
        <div ref={containerRef} className="h-screen w-screen" />

        <button
          type="button"
          onClick={goPrev}
          aria-label={t('reader.prevPage')}
          className="fixed left-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-2.5 text-white opacity-20 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={goNext}
          aria-label={t('reader.nextPage')}
          className="fixed right-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-2.5 text-white opacity-20 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/75 px-4 py-1.5 text-xs font-medium text-white opacity-25 shadow-lg backdrop-blur transition hover:opacity-100">
          <span>{t('reader.pageNumber', { current: pageNumber })}</span>
          <button
            type="button"
            onClick={onToggleLayout}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] hover:bg-white/25"
          >
            {isDouble ? t('reader.singlePage') : t('reader.doublePage')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto flex flex-col gap-4 ${isDouble ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-slate-500">
            {t('reader.loadingBook')}
          </div>
        )}
        <div ref={containerRef} className="min-h-[65vh] w-full" />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={goPrev}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t('reader.prevPage')}</span>
        </button>

        <span className="text-sm font-medium text-slate-700">{t('reader.pageNumber', { current: pageNumber })}</span>

        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <span>{t('reader.nextPage')}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-center text-xs text-slate-500">{t('reader.keyboardHint')}</p>
    </div>
  );
}

export function BookReaderPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<ReaderTheme>('light');
  const [fontSize, setFontSize] = useState(18);
  const [pageLayout, setPageLayoutState] = useState<PageLayout>(readSavedLayout);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const bookId = Number(id);

  const setPageLayout = useCallback((next: PageLayout) => {
    setPageLayoutState(next);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleLayout = useCallback(() => {
    setPageLayout(pageLayout === 'double' ? 'single' : 'double');
  }, [pageLayout, setPageLayout]);

  const toggleFullscreen = useCallback(async () => {
    const el = readerRootRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }
      if (!isFullscreen && el && typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
        setIsFullscreen(true);
        return;
      }
    } catch {
      // Fallback to CSS full-viewport overlay if native Fullscreen API is unavailable/blocked
    }
    setIsFullscreen((prev) => !prev);
  }, [isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen, toggleFullscreen]);

  useEffect(() => {
    if (!Number.isInteger(bookId) || bookId <= 0) {
      setError(t('book.invalidId'));
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .getBook(bookId)
      .then((res) => setBook(res.book))
      .catch((err) => setError(err instanceof Error ? err.message : t('book.loadError')))
      .finally(() => setLoading(false));
  }, [bookId, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-slate-500">
        {t('reader.loadingBook')}
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-red-600">{error || t('book.notFound')}</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('book.backToLibrary')}
        </Link>
      </div>
    );
  }

  const format: BookFormat = getBookFormat(book.fileName, book.fileMime);
  const contentUrl = book.contentUrl ?? `/api/books/${book.id}/content`;
  const styles = format === 'text' ? THEME_CLASSES[theme] : THEME_CLASSES.light;

  return (
    <div
      ref={readerRootRef}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      className={
        isFullscreen
          ? `fixed inset-0 z-50 h-screen w-screen overflow-auto ${format === 'pdf' ? 'bg-slate-950' : styles.surface}`
          : `min-h-[calc(100vh-4rem)] pb-12 transition-colors ${styles.page}`
      }
    >
      {isFullscreen ? (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-pressed="true"
          className="fixed right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 px-3.5 py-2 text-xs font-medium text-white opacity-25 shadow-lg backdrop-blur transition hover:opacity-100 focus:opacity-100"
        >
          <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('reader.exitFullscreen')}</span>
        </button>
      ) : (
        <div className={`border-b ${styles.surface} ${styles.border}`}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to={`/books/${book.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('reader.backToBook')}</span>
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold">{book.title}</h1>
                <p className={`truncate text-xs ${styles.muted}`}>{t('common.byAuthor', { author: book.author })}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {format !== 'unsupported' && (
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs font-medium text-slate-700">
                  <button
                    type="button"
                    onClick={() => setPageLayout('single')}
                    aria-pressed={pageLayout === 'single'}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
                      pageLayout === 'single' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('reader.singlePage')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageLayout('double')}
                    aria-pressed={pageLayout === 'double'}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
                      pageLayout === 'double' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('reader.doublePage')}</span>
                  </button>
                </div>
              )}

              {(format === 'text' || format === 'epub') && (
                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-slate-700">
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                    aria-label={t('reader.decreaseFont')}
                    className="rounded px-2 py-1 text-xs font-semibold hover:bg-slate-100"
                  >
                    A-
                  </button>
                  <span className="px-1 text-xs text-slate-500">{fontSize}px</span>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                    aria-label={t('reader.increaseFont')}
                    className="rounded px-2 py-1 text-xs font-semibold hover:bg-slate-100"
                  >
                    A+
                  </button>
                </div>
              )}

              {format === 'text' && (
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs font-medium text-slate-700">
                  {(['light', 'sepia', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTheme(mode)}
                      className={`rounded px-2.5 py-1 transition ${
                        theme === mode ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'
                      }`}
                    >
                      {mode === 'light'
                        ? t('reader.themeLight')
                        : mode === 'sepia'
                          ? t('reader.themeSepia')
                          : t('reader.themeDark')}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-pressed="false"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('reader.enterFullscreen')}</span>
              </button>

              <a
                href={book.downloadUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('book.download')}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      <div className={isFullscreen ? 'h-full w-full' : 'mx-auto max-w-6xl px-4 pt-6 sm:px-6'}>
        {format === 'text' && (
          <TextBookReader
            book={book}
            contentUrl={contentUrl}
            theme={theme}
            fontSize={fontSize}
            isFullscreen={isFullscreen}
            pageLayout={pageLayout}
            onToggleLayout={toggleLayout}
            scrollContainerRef={readerRootRef}
          />
        )}
        {format === 'pdf' && (
          <PdfBookReader
            book={book}
            contentUrl={contentUrl}
            isFullscreen={isFullscreen}
            pageLayout={pageLayout}
            onToggleLayout={toggleLayout}
          />
        )}
        {format === 'epub' && (
          <EpubBookReader
            book={book}
            contentUrl={contentUrl}
            fontSize={fontSize}
            isFullscreen={isFullscreen}
            pageLayout={pageLayout}
            onToggleLayout={toggleLayout}
          />
        )}
        {format === 'unsupported' && (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{t('reader.unsupportedTitle')}</h2>
            <p className="mt-2 text-sm text-slate-600">{t('reader.unsupportedBody')}</p>
            <a
              href={book.downloadUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t('book.download')}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
