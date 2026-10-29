import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Plus, Settings } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ADMIN_USER_UPDATED_EVENT, getAdminUser, setAdminUser } from './lib/storage';

const PublicSearchPage = lazy(() => import('./pages/PublicSearchPage').then(module => ({ default: module.PublicSearchPage })));
const PublicOrderTrackingPage = lazy(() => import('./pages/PublicOrderTrackingPage').then(module => ({ default: module.PublicOrderTrackingPage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then(module => ({ default: module.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
const AdminOrderFormPage = lazy(() => import('./pages/AdminOrderFormPage').then(module => ({ default: module.AdminOrderFormPage })));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage').then(module => ({ default: module.AdminSettingsPage })));

function RequireAdmin({ children, role }: { children: React.ReactNode; role?: 'admin' }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let current = true;
    void fetch('/api/admin-session', { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) {
          setAdminUser(null);
          if (current) setAuthenticated(false);
          return;
        }
        const result = await response.json() as {
          user?: { id?: string | null; username?: string; name?: string; role?: string };
        };
        const user = result.user;
        if (
          !user ||
          (typeof user.id !== 'string' && user.id !== null) ||
          (user.role === 'admin' && user.id !== null) ||
          (user.role === 'tecnico' && typeof user.id !== 'string') ||
          typeof user.username !== 'string' ||
          typeof user.name !== 'string' ||
          (user.role !== 'admin' && user.role !== 'tecnico')
        ) {
          setAdminUser(null);
          if (current) setAuthenticated(false);
          return;
        }
        setAdminUser({
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        });
        if (role === 'admin' && user.role !== 'admin') {
          if (current) setAuthenticated(true);
          return;
        }
        if (current) setAuthorized(true);
        if (current) setAuthenticated(true);
      })
      .catch(error => {
        console.error('Failed to validate the administrative session', error);
        setAdminUser(null);
        if (current) setAuthenticated(false);
      });
    return () => { current = false; };
  }, []);

  if (authenticated === null) {
    return <div className="flex flex-1 items-center justify-center p-8" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--sa-accent)]/20 border-t-[var(--sa-accent)]" />
      <span className="sr-only">Validando acesso administrativo...</span>
    </div>;
  }
  if (!authenticated) return <Navigate to="/admin/login" replace />;
  if (role === 'admin' && !authorized) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const [adminRole, setAdminRole] = useState(getAdminUser()?.role || null);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPublicRoute = !isAdminRoute;
  const isPublicSearchRoute = location.pathname === '/consultar';
  const showAdminNavigation = isAdminRoute && location.pathname !== '/admin/login';

  useEffect(() => {
    const updateAdminRole = () => setAdminRole(getAdminUser()?.role || null);
    window.addEventListener(ADMIN_USER_UPDATED_EVENT, updateAdminRole);
    return () => window.removeEventListener(ADMIN_USER_UPDATED_EVENT, updateAdminRole);
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col selection:bg-[var(--sa-accent)] selection:text-[var(--sa-bg)] font-sans ${isAdminRoute ? 'app-admin-shell' : ''} ${isPublicRoute ? 'app-public-shell' : ''} ${isPublicSearchRoute ? 'app-public-search-shell' : ''}`}
      style={{ backgroundColor: 'var(--sa-bg)', color: 'var(--sa-text)' }}
    >
      <Header />
      <main className={`flex-1 flex flex-col ${showAdminNavigation ? 'pb-32' : ''}`}>
          <Suspense fallback={<div className="flex flex-1 items-center justify-center p-8" role="status" aria-live="polite"><span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--sa-accent)]/20 border-t-[var(--sa-accent)]" /><span className="sr-only">Carregando página...</span></div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/consultar" replace />} />
            <Route path="/consultar" element={<PublicSearchPage />} />
            <Route path="/consultar/:osNumber" element={<PublicOrderTrackingPage />} />
            <Route path="/os/:osNumber" element={<PublicOrderTrackingPage />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
            <Route path="/admin/os/new" element={<RequireAdmin><AdminOrderFormPage /></RequireAdmin>} />
            <Route path="/admin/os/edit/:id" element={<RequireAdmin><AdminOrderFormPage /></RequireAdmin>} />
            <Route path="/admin/settings" element={<RequireAdmin role="admin"><AdminSettingsPage /></RequireAdmin>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/consultar" replace />} />
          </Routes>
          </Suspense>
      </main>
      {showAdminNavigation && (
        <nav aria-label="Navegação principal" className="app-bottom-nav md:hidden">
          <Link to="/admin" className={`app-bottom-nav__item ${location.pathname === '/admin' ? 'is-active' : ''}`}>
            <LayoutDashboard className="h-[18px] w-[18px]" />
            <span>Painel</span>
          </Link>
          <Link to="/admin/os/new" className={`app-bottom-nav__item ${location.pathname.includes('/os/') ? 'is-active' : ''}`}>
            <Plus className="h-[18px] w-[18px]" />
            <span>Nova OS</span>
          </Link>
          {adminRole === 'admin' && (
            <Link to="/admin/settings" className={`app-bottom-nav__item ${location.pathname === '/admin/settings' ? 'is-active' : ''}`}>
              <Settings className="h-[18px] w-[18px]" />
              <span>Ajustes</span>
            </Link>
          )}
        </nav>
      )}
      {!isAdminRoute && !isPublicSearchRoute && <Footer />}
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
