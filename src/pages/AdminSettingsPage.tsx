import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  CheckCircle,
  AlertTriangle,
  Save,
  Server,
  Store,
  RefreshCw,
  Code,
} from 'lucide-react';
import { StoreSettings } from '../types';
import { getStoreSettings, saveStoreSettings } from '../lib/storage';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';

export const AdminSettingsPage: React.FC = () => {
  const [store, setStore] = useState<StoreSettings>(getStoreSettings());
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [storeSavedMessage, setStoreSavedMessage] = useState(false);

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    if (config) {
      setSupabaseUrl(config.url);
      setSupabaseKey(config.anonKey);
    }
  }, []);

  const handleTestAndSaveSupabase = async () => {
    setTesting(true);
    setTestResult(null);

    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      saveStoredSupabaseConfig(null);
      setTestResult({
        success: true,
        message: 'Configuração local do cliente removida. Isso não altera nem substitui as credenciais do Supabase configuradas na Vercel.',
      });
      setTesting(false);
      return;
    }

    const res = await testSupabaseConnection(supabaseUrl.trim(), supabaseKey.trim());
    setTestResult(res);

    if (res.success) {
      saveStoredSupabaseConfig({
        url: supabaseUrl.trim(),
        anonKey: supabaseKey.trim(),
      });
    }

    setTesting(false);
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    saveStoreSettings(store);
    setTimeout(() => {
      setSavingStore(false);
      setStoreSavedMessage(true);
      setTimeout(() => setStoreSavedMessage(false), 3000);
    }, 500);
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Painel</span>
        </Link>
      </div>

      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white">Configurações do Sistema</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Gerencie o banco de dados Supabase e os dados de contato da Store Acessórios.
        </p>
      </div>

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ==================================================== */}
        {/* LEFT: SUPABASE INTEGRATION */}
        {/* ==================================================== */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
              <Database className="w-5 h-5 text-[#FF6A00]" />
              <div>
                <h3 className="text-base font-bold">Banco de Dados & Supabase</h3>
                <p className="text-xs text-zinc-400">PostgreSQL, Autenticação e Storage</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              As ordens são lidas e gravadas pela API segura do servidor usando as credenciais configuradas na Vercel. Os campos abaixo testam apenas uma conexão pública do navegador e não ativam armazenamento local nem substituem a configuração do servidor.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  URL do Projeto Supabase
                </label>
                <input
                  type="url"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">
                  Chave Anônima Pública (Anon Key)
                </label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={e => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-red-950/60 border-red-700 text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <p className="leading-snug">{testResult.message}</p>
                </div>
              )}

              <button
                type="button"
                disabled={testing}
                onClick={handleTestAndSaveSupabase}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 transition"
              >
                {testing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Server className="w-4 h-4 text-[#FF6A00]" />
                    <span>Testar e Salvar Conexão Supabase</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Supabase setup instructions */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-white">
              <Code className="w-4 h-4 text-[#FF6A00]" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Configuração do Supabase
              </h4>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              No painel do Supabase, siga esta ordem para preparar o banco e o armazenamento privado das fotos. O login administrativo é configurado separadamente no servidor:
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-[11px] leading-relaxed text-zinc-300">
              <li>
                No <strong>SQL Editor</strong>, execute <code>supabase/migrations/001_initial_schema.sql</code>.
              </li>
              <li>
                Em seguida, execute <code>supabase/migrations/002_private_order_photo_storage.sql</code>. Ela cria o bucket privado e as permissões para fotos.
              </li>
              <li>
                Execute as migrations <code>003_budget_approval.sql</code> e <code>004_direct_budget_approval.sql</code> para ativar a aprovação de orçamento.
              </li>
              <li>
                Execute as migrations <code>005_username_login.sql</code> até <code>012_supabase_auth_and_security_hardening.sql</code>, em ordem, para os recursos e permissões do banco. Elas não configuram nem validam o login administrativo.
              </li>
              <li>
                Configure <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD_HASH</code> e <code>ADMIN_SESSION_SECRET</code> com o comando <code>npm run admin:set-password</code>. Configure <code>SUPABASE_URL</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code> separadamente para os dados da loja. Nunca publique a chave de serviço no navegador.
              </li>
            </ol>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT: STORE COMMERCIAL DATA */}
        {/* ==================================================== */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white border-b border-zinc-800 pb-3">
            <Store className="w-5 h-5 text-[#FF6A00]" />
            <div>
              <h3 className="text-base font-bold">Dados Comerciais da Loja</h3>
              <p className="text-xs text-zinc-400">Exibidos na consulta pública e no rodapé</p>
            </div>
          </div>

          {storeSavedMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Dados comerciais salvos com sucesso!</span>
            </div>
          )}

          <form onSubmit={handleSaveStore} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  value={store.store_name}
                  onChange={e => setStore({ ...store, store_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={store.document_cnpj || ''}
                  onChange={e => setStore({ ...store, document_cnpj: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Telefone Fixo</label>
                <input
                  type="text"
                  value={store.phone}
                  onChange={e => setStore({ ...store, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">WhatsApp da Loja</label>
                <input
                  type="text"
                  value={store.whatsapp}
                  onChange={e => setStore({ ...store, whatsapp: e.target.value })}
                  placeholder="5511999998888"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono focus:border-[#FF6A00]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Endereço da Loja</label>
              <input
                type="text"
                value={store.address}
                onChange={e => setStore({ ...store, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Cidade</label>
                <input
                  type="text"
                  value={store.city}
                  onChange={e => setStore({ ...store, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  value={store.state}
                  onChange={e => setStore({ ...store, state: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Horário (Segunda a Sexta)</label>
              <input
                type="text"
                value={store.business_hours_week}
                onChange={e => setStore({ ...store, business_hours_week: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Horário (Sábado)</label>
              <input
                type="text"
                value={store.business_hours_saturday}
                onChange={e => setStore({ ...store, business_hours_saturday: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Instruções para Retirada</label>
              <textarea
                rows={2}
                value={store.pickup_instructions}
                onChange={e => setStore({ ...store, pickup_instructions: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 mb-1">Termo de Garantia Padrão</label>
              <textarea
                rows={2}
                value={store.default_warranty}
                onChange={e => setStore({ ...store, default_warranty: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:border-[#FF6A00]"
              />
            </div>

            <button
              type="submit"
              disabled={savingStore}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--sa-accent)] hover:bg-[#E85F00] hover:brightness-110 text-white font-bold text-xs  transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Dados Comerciais</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
