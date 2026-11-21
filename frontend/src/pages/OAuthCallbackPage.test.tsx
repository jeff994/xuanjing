import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { OAuthCallbackPage } from './OAuthCallbackPage';

describe('OAuthCallbackPage', () => {
  it('rejects raw #token= callback URLs without a browser-initiated tx', async () => {
    window.history.replaceState(null, '', '/oauth/callback#token=attacker-forged-jwt');

    render(
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/oauth/callback']}>
            <OAuthCallbackPage />
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    );

    expect(await screen.findByText('Sign-in failed')).toBeInTheDocument();
    expect(localStorage.getItem('book_portal_jwt')).toBeNull();
  });
});
