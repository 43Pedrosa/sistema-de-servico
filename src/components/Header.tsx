import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, User, Database, LogOut, Sun, Moon } from 'lucide-react';
import { ADMIN_USER_UPDATED_EVENT, getAdminUser, setAdminUser } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './BrandLogo';

export const Header: React.FC = () => {
  const location = useLocation();
  const [adminUser, setCurrentAdminUser] = useState(getAdminUser());
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPublicSearchRoute = location.pathname === '/consultar';
  const isOrderTrackingRoute = /^\/(?:consultar|os)\/[^/]+$/.test(location.pathname);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const updateAdminUser = () => setCurrentAdminUser(getAdminUser());
    window.addEventListener(ADMIN_USER_UPDATED_EVENT, updateAdminUser);
    return () => window.removeEventListener(ADMIN_USER_UPDATED_EVENT, updateAdminUser);
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin-logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Logout endpoint failed with HTTP ${response.status}.`);
    } catch (error) {
      console.error('Failed to end administrative session', error);
    } finally {
      setAdminUser(null);
      window.location.href = '/admin/login';
    }
  };

  return (
    <header className={`sa-header ${location.pathname === '/consultar' ? 'sa-header--public-search' : ''} ${isOrderTrackingRoute ? 'sa-header--tracking' : ''}`}>
      <div className="sa-header-inner">
        {!isAdminRoute && !isPublicSearchRoute && (
          <Link to="/consultar" className="sa-header-brand" aria-label="Store Acessórios — página de consulta">
            <BrandLogo size="sm" />
            <span>Store Acessórios</span>
          </Link>
        )}
        {/* Actions / Navigation */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Database indicator (Admin only or subtle) */}
          {isAdminRoute && adminUser?.role === 'admin' && (
            <Link
              to="/admin/settings"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-700 bg-zinc-900 text-zinc-300"
              title="Ordens compartilhadas são lidas e gravadas pela API segura do servidor."
            >
              <Database className="w-3.5 h-3.5" />
              <span>Dados via servidor</span>
            </Link>
          )}

          {/* Customer / Technician quick switch */}
          {isAdminRoute ? (
            <div className="flex items-center gap-2">
              <Link
                to="/consultar"
              className="sa-secondary-button sa-focus min-h-10 px-3"
              >
                <Search className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span className="hidden sm:inline">Página do Cliente</span>
              </Link>
              {adminUser && (
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
                  title="Sair do painel"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : !isOrderTrackingRoute ? (
            <Link
              to="/admin"
              className="sa-secondary-button sa-focus min-h-9 px-3 text-xs"
            >
              <User className="w-3.5 h-3.5 text-[var(--sa-accent)]" />
              <span className="hidden sm:inline">Painel Técnico</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            className="sa-icon-button sa-focus"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </header>
  );
};
