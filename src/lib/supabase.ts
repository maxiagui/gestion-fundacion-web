import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'aacm-auth-token-v3', // Force fresh lock generation avoiding the v2 corruption
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
