import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY = 'store_acessorios_supabase_config';

export function getStoredSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read Supabase config from localStorage', e);
  }

  // Fallback to environment variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey && !envUrl.includes('your-project')) {
    return { url: envUrl, anonKey: envKey };
  }

  return null;
}

export function saveStoredSupabaseConfig(config: SupabaseConfig | null): void {
  if (config && config.url && config.anonKey) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  // Clear cached client
  cachedClient = null;
  clientPromise = null;
}

let cachedClient: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;
  if (clientPromise) return clientPromise;

  const config = getStoredSupabaseConfig();
  if (!config) return null;

  const pendingClient = (async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const currentConfig = getStoredSupabaseConfig();
      if (!currentConfig || currentConfig.url !== config.url || currentConfig.anonKey !== config.anonKey) return null;
      try {
        const projectRef = new URL(config.url).hostname.split('.')[0];
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
      } catch (error) {
        console.warn('Could not clear the legacy Supabase Auth session', error);
      }
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      return cachedClient;
    } catch (error) {
      console.error('Error creating Supabase client:', error);
      return null;
    }
  })();
  clientPromise = pendingClient;
  try {
    return await pendingClient;
  } finally {
    if (clientPromise === pendingClient) clientPromise = null;
  }
}

export function isSupabaseConnected(): boolean {
  return getStoredSupabaseConfig() !== null;
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const testClient = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await testClient
      .from('public_service_orders_view')
      .select('id', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116' && !error.message.includes('permission denied')) {
      // Check if it's a table not found error or genuine network issue
      if (error.message.includes('relation "service_orders" does not exist') || error.code === '42P01') {
        return {
          success: true,
          message: 'Conectado com sucesso ao Supabase! Lembre-se de rodar o script SQL de migrations para criar as tabelas.',
        };
      }
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }

    return {
      success: true,
      message: 'Conexão com o Supabase estabelecida e autenticada com sucesso!',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Falha na requisição: ${msg}` };
  }
}
