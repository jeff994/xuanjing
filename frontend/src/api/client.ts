import { Book, Comment, User } from '../types';

const TOKEN_KEY = 'book_portal_jwt';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${response.status})`);
  }

  return data as T;
}

export const api = {
  // Auth
  register(payload: { username: string; email: string; password: string }) {
    return request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request<{ user: User }>('/api/auth/me');
  },

  // Books
  listBooks(search?: string) {
    const query = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
    return request<{ books: Book[] }>(`/api/books${query}`);
  },

  getBook(id: number) {
    return request<{ book: Book }>(`/api/books/${id}`);
  },

  uploadBook(formData: FormData) {
    return request<{ book: Book }>('/api/books', {
      method: 'POST',
      body: formData,
    });
  },

  deleteBook(id: number) {
    return request<void>(`/api/books/${id}`, {
      method: 'DELETE',
    });
  },

  // Comments
  listComments(bookId: number) {
    return request<{ comments: Comment[] }>(`/api/books/${bookId}/comments`);
  },

  addComment(bookId: number, content: string) {
    return request<{ comment: Comment }>(`/api/books/${bookId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  deleteComment(commentId: number) {
    return request<void>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    });
  },
};
