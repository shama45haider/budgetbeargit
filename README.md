# Budget Bear

Budgeting that feels effortless. Budget Bear is a mobile-first personal finance
PWA with goals, a daily plan, plain-English insights, and an AI financial coach
that reasons from your real numbers.

**Live app:** deployed automatically to GitHub Pages on every push to `main`.
**Website:** [budgetbear.xyz](https://budgetbear.xyz) · **Support:** [help@budgetbear.xyz](mailto:help@budgetbear.xyz)

## What's inside

- **Conversational onboarding** — builds your budget from a few questions, no forms.
- **Home** — answers "what should I do today": money left today, upcoming bills, goal progress, health score, one coach recommendation.
- **Goals** — templates, completion %, required saving, ETA, risk level, and next action, all computed live.
- **Budget** — category budgets with pace bars, two-tap expense entry, recurring bill manager.
- **AI Coach** — a deterministic financial-analysis engine that answers "Can I afford $400?", "I want to buy a house", debt payoff (avalanche vs snowball), subscription audits, and more — always with its reasoning shown. Optionally upgraded to a real LLM (Groq, free tier) via a Supabase Edge Function — see SETUP-SUPABASE.md — with automatic fallback to the instant local engine.
- **Insights** — plain-English observations, six-factor financial health score, and a 12-month timeline with what-if scenarios (raise, big purchase, extra savings, debt attack).
- **Bear Points & achievements** — daily check-in streaks and mascot-animated achievement unlocks.
- **PWA** — installable, offline-first, personal budget data stays in the browser (`localStorage`).

## Online team features (Supabase)

- **Accounts & Discord-style profiles** — any display name, avatar upload, banner + accent colors, status, about me.
- **Group Links** — create a shared goal ("Florida trip"), share one invite link, friends join and race on a **live leaderboard**: everyone gets their own accent color and status bar, and the biggest saver rises to the top in real time.
- **Group-only achievements** (Squad Assembled, Perfect Week, Photo Finish…) celebrated with the mascot overlay, plus a **daily group tip** computed from the group's real pace.
- Personal budgets stay on-device; the cloud stores only profiles and groups.

Online features need a one-time free Supabase setup — see **[SETUP-SUPABASE.md](SETUP-SUPABASE.md)**. Without it the app runs exactly as before, fully offline.

## Architecture

Zero-dependency vanilla JavaScript (ES modules), CSS design tokens, semantic HTML.
No build step — the repo root deploys as-is via `.github/workflows/static.yml`.

```
index.html            app shell
manifest.webmanifest  PWA manifest
sw.js                 service worker (offline cache)
css/                  tokens → base → components → screens
js/
  store.js            versioned localStorage state + pub/sub
  router.js           hash router
  engine/             metrics, goals, health, insights, forecast, coach, review, points
  screens/            home, goals, budget, coach, insights, profile, onboarding
  ui/                 sheet/toast/ring/charts/achievement overlay
  data/               category catalog, achievements, demo seed
assets/               logo, bear mascots, icons
```

## Run locally

Any static file server works:

```
python -m http.server 8321
```

Then open http://localhost:8321. Choose **"Try with sample data"** on first launch
to explore with a realistic demo dataset.
