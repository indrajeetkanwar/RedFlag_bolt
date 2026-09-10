import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ]
    .filter(Boolean)
    .join(', ');

  throw new Error(
    `Missing Supabase environment variable(s): ${missing}. ` +
      'Copy .env.example to .env at the project root and fill in your Supabase ' +
      'Project URL and anon public key (Supabase dashboard → Project Settings → API), ' +
      'then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
