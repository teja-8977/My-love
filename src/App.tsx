import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/AuthProvider';
import { FullscreenLoader, Toaster } from './components/ui';
import { isSupabaseConfigured } from './lib/supabase';
import WelcomePage from './pages/WelcomePage';
import SetupMissing from './pages/SetupMissing';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ManageMuseum = lazy(() => import('./pages/ManageMuseum'));
const AvatarStudio = lazy(() => import('./pages/AvatarStudio'));
const LobbyPage = lazy(() => import('./pages/LobbyPage'));
const TourPage = lazy(() => import('./pages/TourPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));

function Guarded({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <SetupMissing />;
  return <RequireAuth>{children}</RequireAuth>;
}

export default function App() {
  return (
    <>
      <Toaster />
      <Suspense fallback={<FullscreenLoader />}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/join/:code" element={<WelcomePage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/setup" element={<SetupMissing />} />
          <Route path="/auth" element={isSupabaseConfigured ? <AuthPage /> : <SetupMissing />} />
          <Route path="/dashboard" element={<Guarded><Dashboard /></Guarded>} />
          <Route path="/avatar" element={<Guarded><AvatarStudio /></Guarded>} />
          <Route path="/museum/:id/manage" element={<Guarded><ManageMuseum /></Guarded>} />
          <Route path="/museum/:id/lobby" element={<Guarded><LobbyPage /></Guarded>} />
          <Route path="/museum/:id/tour" element={<Guarded><TourPage /></Guarded>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
