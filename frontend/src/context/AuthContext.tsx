import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setStoredToken(res.token);
    setUser(res.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await api.register({ username, email, password });
    setStoredToken(res.token);
    setUser(res.user);
  };

  const loginWithToken = useCallback(async (token: string) => {
    setStoredToken(token);
    try {
      const res = await api.me();
      setUser(res.user);
    } catch (err) {
      setStoredToken(null);
      setUser(null);
      throw err;
    }
  }, []);

  const logout = () => {
    setStoredToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
