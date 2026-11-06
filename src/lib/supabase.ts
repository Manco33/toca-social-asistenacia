import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://lgdoyivzdnybvlbfgtnu.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_hS0OduXLZ5thKWSZO5u0Hg_8V_dTuzp';

const SUPABASE_URL = (
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_URL
).trim();

const SUPABASE_ANON_KEY = (
  process.env['NEXT_PUBLIC_SUPABASE_KEY'] ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY ||
  DEFAULT_ANON_KEY
).trim();

const SUPABASE_SERVICE_KEY = (
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
  process.env['SUPABASE_SERVICE_KEY'] ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  SUPABASE_ANON_KEY
).trim();

// Cliente público para navegador
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Cliente administrativo para servidor (omite RLS)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

