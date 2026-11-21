import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { Navbar } from './Navbar';

function renderNavbar() {
  return render(
    <LanguageProvider>
      <AuthProvider>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

describe('Navbar', () => {
  it('switches languages live and updates document lang', () => {
    renderNavbar();

    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();

    const selector = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.change(selector, { target: { value: 'zh' } });

    expect(screen.getByRole('link', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '注册账号' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-CN');

    fireEvent.change(selector, { target: { value: 'es' } });
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('es-ES');
  });
});
