/* Budget Bear — Supabase project config.
   Get both values from: Supabase Dashboard → Project Settings → API.
   The anon key is safe to ship in client code — all access is enforced
   by row-level security in supabase/schema.sql. */

export const SUPABASE_URL = "https://wxnajrkonkcilfilvoyw.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4bmFqcmtvbmtjaWxmaWx2b3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzE0MDgsImV4cCI6MjA5OTYwNzQwOH0.rTd_fMjCqAdpiawR-H4o8VC76A2V_uXSyx5OXSDqc4c";

/* Flip to true after configuring Google in Supabase
   (Dashboard → Authentication → Providers → Google — see SETUP-SUPABASE.md). */
export const GOOGLE_AUTH_ENABLED = false;

/* Cloudflare Turnstile (free) stops scripted mass signups, which is the
   main way a stranger burns through Supabase's email-sending rate limit.
   Get a site key at dash.cloudflare.com → Turnstile, enable "Captcha
   protection" in Supabase Dashboard → Authentication → Attack Protection,
   paste the SECRET key there, then paste the SITE key below and flip this
   on. See SETUP-SUPABASE.md. */
export const TURNSTILE_ENABLED = false;
export const TURNSTILE_SITE_KEY = "";

/* Donation link (PayPal.me, Buy Me a Coffee, Stripe Payment Link, …).
   The "Support Budget Bear" feature stays hidden while this is empty.
   Donors get a Supporter code by email — mint codes with the SQL one-liner
   in SETUP-SUPABASE.md — and redeem them in the app for the thank-you
   bundle (Aurora Crown flair + Early Supporter tag + 200 points). */
export const DONATE_URL = "";

export function cloudConfigured() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
}
