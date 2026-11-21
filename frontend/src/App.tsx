import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { BookDetailPage } from './pages/BookDetailPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { RegisterPage } from './pages/RegisterPage';
import { UploadBookPage } from './pages/UploadBookPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/books/:id" element={<BookDetailPage />} />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <UploadBookPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
