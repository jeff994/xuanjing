import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import { BookReaderPage } from './BookReaderPage';

describe('BookReaderPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a text book page by page with Next/Prev, keyboard arrows, and saved progress', async () => {
    const longChapter1 = `CHAPTER ONE START ${'alpha '.repeat(220)}`;
    const longChapter2 = `CHAPTER TWO START ${'beta '.repeat(220)}`;
    const bookText = `${longChapter1}\n\n${longChapter2}`;

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/books/7') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              book: {
                id: 7,
                title: 'Distributed Systems',
                author: 'Jane Doe',
                description: 'Notes',
                fileName: 'notes.txt',
                fileMime: 'text/plain',
                fileSize: bookText.length,
                coverUrl: null,
                downloadUrl: '/api/books/7/download',
                contentUrl: '/api/books/7/content',
                uploadedBy: 1,
                uploaderUsername: 'alice',
                commentCount: 0,
                createdAt: '2026-11-21T00:00:00.000Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      if (url === '/api/books/7/content') {
        return Promise.resolve(new Response(bookText, { status: 200, headers: { 'Content-Type': 'text/plain' } }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/books/7/read']}>
          <Routes>
            <Route path="/books/:id/read" element={<BookReaderPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    );

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    expect(await screen.findByText(/CHAPTER ONE START/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

    // Click Next to go to Page 2 and verify viewport resets to top
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/CHAPTER TWO START/)).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    expect(localStorage.getItem('book_portal_progress_7')).toBe('2');
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);

    // Press ArrowLeft to go back to Page 1
    scrollToSpy.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await screen.findByText(/CHAPTER ONE START/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);

    // Toggle fullscreen mode via button: top header disappears, exit button appears
    const fullscreenBtn = screen.getByRole('button', { name: 'Fullscreen' });
    fireEvent.click(fullscreenBtn);
    expect(await screen.findByRole('button', { name: 'Exit Fullscreen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: 'Book Details' })).not.toBeInTheDocument();

    // In fullscreen mode, turning page resets the fullscreen container scrollTop
    const fsRoot = document.querySelector('[data-fullscreen="true"]') as HTMLDivElement;
    fsRoot.scrollTop = 420;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(await screen.findByText(/CHAPTER TWO START/)).toBeInTheDocument();
    expect(fsRoot.scrollTop).toBe(0);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await screen.findByText(/CHAPTER ONE START/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('button', { name: 'Fullscreen' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('link', { name: 'Book Details' })).toBeInTheDocument();

    // Switch to Double page mode: both chapters appear side by side
    fireEvent.click(screen.getByRole('button', { name: 'Double' }));
    expect(screen.getByText(/CHAPTER ONE START/)).toBeInTheDocument();
    expect(screen.getByText(/CHAPTER TWO START/)).toBeInTheDocument();
    expect(screen.getByText(/Pages 1–2 of 2/)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
