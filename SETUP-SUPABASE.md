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

## Done

Commit the config change and push — the deployed app picks it up on the next
Pages deploy. Locally, just reload.
