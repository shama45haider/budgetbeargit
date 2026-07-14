/* Budget Bear — Supabase project config.
   Get both values from: Supabase Dashboard → Project Settings → API.
   The anon key is safe to ship in client code — all access is enforced
   by row-level security in supabase/schema.sql. */

export const SUPABASE_URL = "";      // e.g. "https://abcdefghijkl.supabase.co"
export const SUPABASE_ANON_KEY = ""; // the long "anon / public" key

/* Flip to true after configuring Google in Supabase
   (Dashboard → Authentication → Providers → Google — see SETUP-SUPABASE.md). */
export const GOOGLE_AUTH_ENABLED = false;

export function cloudConfigured() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
}
