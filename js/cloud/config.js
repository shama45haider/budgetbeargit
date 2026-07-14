/* Budget Bear — Supabase project config.
   Get both values from: Supabase Dashboard → Project Settings → API.
   The anon key is safe to ship in client code — all access is enforced
   by row-level security in supabase/schema.sql. */

export const SUPABASE_URL = "https://wxnajrkonkcilfilvoyw.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bmFqcmtvbmtjaWxmaWx2b3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzE0MDgsImV4cCI6MjA5OTYwNzQwOH0.rTd_fMjCqAdpiawR-H4o8VC76A2V_uXSyx5OXSDqc4c";

/* Flip to true after configuring Google in Supabase
   (Dashboard → Authentication → Providers → Google — see SETUP-SUPABASE.md). */
export const GOOGLE_AUTH_ENABLED = false;

export function cloudConfigured() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
}
