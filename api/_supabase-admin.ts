import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getAdminDataClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    ...(!url ? ['SUPABASE_URL (or VITE_SUPABASE_URL)'] : []),
    ...(!serviceRoleKey ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
  ];
  if (missing.length) {
    throw new Error(`Missing server-side Supabase environment variables: ${missing.join(', ')}`);
  }
  if (!url || !serviceRoleKey) {
    throw new Error('Server-side Supabase configuration is incomplete.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

