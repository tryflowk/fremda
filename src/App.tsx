import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from '@/lib/auth';
import { LibraryPage } from '@/pages/LibraryPage';
import { ReadingPage } from '@/pages/ReadingPage';
import { AuthPage } from '@/pages/AuthPage';
import { Spinner } from '@/components/Spinner';

function AppRoutes() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/read/:bookId" element={<ReadingPage />} />
      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
