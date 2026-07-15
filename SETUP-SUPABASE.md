# Budget Bear — Supabase setup (one time, ~5 minutes)

Accounts, profiles, and Group Links run on a free Supabase project. Nothing works
online until these steps are done; the app stays fully usable offline without them.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up (free).
2. **New project** → any name (e.g. `budgetbear`) → set a database password (save it
   somewhere; you won't need it day-to-day) → pick the region closest to you → **Create**.
3. Wait ~1 minute for provisioning.

## 2. Run the schema

1. In the project dashboard, open **SQL Editor** (left sidebar) → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy **all** of it,
   paste into the editor, press **Run**.
3. You should see "Success. No rows returned". Re-running it later is safe.

## 3. Paste the config into the app

1. Dashboard → **Project Settings** (gear icon) → **API**.
2. Copy **Project URL** and the **anon / public** key.
3. Open [`js/cloud/config.js`](js/cloud/config.js) and fill in:

```js
export const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ…";  // the long anon key
```

The anon key is designed to be public — every table is protected by row-level
security defined in the schema.

## 4. Auth settings

1. Dashboard → **Authentication** → **URL Configuration**:
   - **Site URL**: `https://shama45haider.github.io/budgetbeargit/`
   - **Redirect URLs**: add both
     - `https://shama45haider.github.io/budgetbeargit/`
     - `http://localhost:8321/` (for local testing)
2. (Optional, recommended while testing) **Authentication → Providers → Email**:
   turn **Confirm email** off so accounts work instantly. Turn it back on for real use.

## 5. Google sign-in (optional)

Email + password and magic links work with zero extra setup. For the
**Continue with Google** button:

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project →
   **APIs & Services → OAuth consent screen** → External → fill the basics.
2. **Credentials → Create credentials → OAuth Client ID** → Web application.
   - Authorized redirect URI: `https://YOURPROJECT.supabase.co/auth/v1/callback`
3. Supabase Dashboard → **Authentication → Providers → Google** → enable, paste the
   Client ID and Secret.
4. In [`js/cloud/config.js`](js/cloud/config.js) set `GOOGLE_AUTH_ENABLED = true`.

## 6. Bot/abuse protection (recommended before real users)

Two layers, both optional but recommended:

**Database-level caps** (already in `supabase/schema.sql` — nothing to do if you've
run the latest version): a user can create at most 30 groups, and contributions are
rate-limited to one per second per user. These stop a malicious script from flooding
your database; they're invisible to real people.

**CAPTCHA on signup/sign-in** (stops scripted mass account creation, which is the
main way strangers burn through Supabase's free email-sending limit):

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add site**
   (free). Widget mode: "Managed" is a good default.
2. Copy the **Site Key** and **Secret Key**.
3. Supabase Dashboard → **Authentication → Attack Protection** → enable **Captcha
   protection**, choose **Turnstile**, paste the **Secret Key**.
4. In [`js/cloud/config.js`](js/cloud/config.js):

```js
export const TURNSTILE_ENABLED = true;
export const TURNSTILE_SITE_KEY = "0x4AAAAAAA...";  // the Site Key, not the secret
```

The secret key stays in Supabase's dashboard only — never put it in client code.

## 7. Supporter codes (donations)

When someone donates (set `DONATE_URL` in `js/cloud/config.js` to your PayPal.me /
Buy Me a Coffee / Stripe link), send them a Supporter code by email. Mint one in
the SQL Editor:

```sql
insert into redeem_codes (code, max_uses) values ('BEAR-THANKS-001', 1);
```

Codes are case-insensitive for the person redeeming. `max_uses` above 1 makes a
shared code (e.g. for a giveaway). Redeeming grants the Aurora Crown flair, the
Early Supporter tag, and 200 Bear Points — each account can redeem a given code
once, enforced server-side.

## Done

Commit the config change and push — the deployed app picks it up on the next
Pages deploy. Locally, just reload.
