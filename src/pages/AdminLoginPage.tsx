import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, UserRound, KeyRound, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { setAdminUser } from '../lib/storage';
import type { AdminUser } from '../types';

export const AdminLoginPage: React.FC = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login.trim(), password }),
      });

      const responseText = await response.text();
      let result: {
        message?: string;
        user?: { id?: string | null; username?: string; name?: string; role?: string };
      };
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (cause) {
        console.error('Administrative login API returned a non-JSON response', cause);
        throw new Error('O servidor não retornou uma resposta válida. Tente novamente.');
      }

      if (!response.ok) {
        throw new Error(result.message || 'Não foi possível entrar no painel.');
      }

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
        throw new Error('O servidor não retornou uma sessão administrativa válida.');
      }
      const authenticatedUser: AdminUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role === 'admin' ? 'admin' : 'tecnico',
      };

      setAdminUser(authenticatedUser);
      navigate('/admin');
    } catch (err: unknown) {
      console.error('Failed to start technician session', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">
            <Shield className="w-3.5 h-3.5 text-[#FF6A00]" />
            <span>Acesso Restrito — Gerência</span>
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">Painel Administrativo</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Entre com as credenciais administrativas configuradas no servidor.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="leading-snug">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                Nome de usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <UserRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={login}
                  onChange={e => setLogin(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00]"
                  placeholder="Seu nome de usuário"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wide">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:border-[#FF6A00] focus:ring-1 focus:ring-[#FF6A00]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(visible => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-500 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF6A00] rounded-r-xl"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="admin-login-submit w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
