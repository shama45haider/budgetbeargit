/* Budget Bear — the front door: sign in, create account, or watch the live demo. */

import { esc } from "../format.js";
import { cloudConfigured, GOOGLE_AUTH_ENABLED, TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from "../cloud/config.js";
import { cloudReady, signIn, signUp, sendMagicLink, signInWithGoogle, currentUser } from "../cloud/client.js";
import { toast, confirmSheet } from "../ui/components.js";
import { showLoader, hideLoader } from "../ui/loader.js";
import { navigate } from "../router.js";
import { get, update, resetAll } from "../store.js";
import { applyDemoSeed } from "../data/seed.js";
import { onSignedIn } from "../engine/points.js";

let mode = "signin"; // signin | signup | magic
let captchaToken = null;
let captchaWidgetId = null;

/** Cloudflare Turnstile only ever loads if TURNSTILE_ENABLED — zero external
    requests otherwise, keeping the app self-contained by default. */
function ensureTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileLoading) return window.__turnstileLoading;
  window.__turnstileLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.__turnstileLoading;
}

function renderCaptcha(view) {
  const el = view.querySelector("#au-captcha");
  if (!el) return;
  captchaToken = null;
  ensureTurnstileScript().then(() => {
    if (!el.isConnected) return; // #view is permanent; its children are not
    captchaWidgetId = window.turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => { captchaToken = token; },
      "expired-callback": () => { captchaToken = null; },
    });
  }).catch(() => { /* offline or blocked — submit will just show the "verify" prompt */ });
}

export function authNext(path) {
  sessionStorage.setItem("bb.authNext", path);
}

export function consumeAuthNext() {
  const next = sessionStorage.getItem("bb.authNext");
  sessionStorage.removeItem("bb.authNext");
  return next || "/home";
}

export function renderAuth(view) {
  if (currentUser()) { navigate(consumeAuthNext()); return; }

  if (!cloudConfigured() || !cloudReady()) {
    view.innerHTML = `
      <div class="screen">
        <div class="empty-state" style="padding-top:80px">
          <img src="assets/bears/confusedbear.webp" alt="">
          <h3>Online features aren't set up yet</h3>
          <p>Accounts and Group Links need the Supabase project configured. See SETUP-SUPABASE.md in the repo.</p>
        </div>
        <button class="btn btn-secondary btn-block" id="au-demo">Watch the live demo instead</button>
      </div>`;
    view.querySelector("#au-demo").addEventListener("click", startDemo);
    return;
  }

  view.innerHTML = `
  <div class="screen auth-screen">
    <div class="auth-hero">
      <img src="assets/banner-wide.webp" alt="Budget Bear" style="width:min(260px,70%);height:auto">
      <h1>${mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p class="t-secondary">${mode === "signup"
        ? "Save with friends, earn Bear Points, and spend them in the Shop."
        : mode === "magic" ? "We'll email you a one-tap sign-in link." : "Sign in to your groups, points, and profile."}</p>
    </div>

    <form id="auth-form" class="stack">
      ${mode === "signup" ? `
        <div class="field"><label class="field-label" for="au-name">Display name</label>
          <input class="input" id="au-name" placeholder="Any name you like" maxlength="32" required></div>` : ""}
      <div class="field"><label class="field-label" for="au-email">Email</label>
        <input class="input" id="au-email" type="email" placeholder="you@example.com" autocomplete="email" required></div>
      ${mode !== "magic" ? `
        <div class="field"><label class="field-label" for="au-pass">Password</label>
          <input class="input" id="au-pass" type="password" placeholder="${mode === "signup" ? "8+ characters" : "Your password"}"
            autocomplete="${mode === "signup" ? "new-password" : "current-password"}" minlength="8" required></div>` : ""}
      ${TURNSTILE_ENABLED ? `<div id="au-captcha" style="margin:2px auto"></div>` : ""}
      <button class="btn btn-primary btn-block" id="au-submit">
        ${mode === "signup" ? "Create account" : mode === "magic" ? "Email me a link" : "Sign in"}
      </button>
    </form>

    <div class="auth-alt">
      ${GOOGLE_AUTH_ENABLED ? `
        <button class="btn btn-secondary btn-block" id="au-google">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Continue with Google
        </button>` : ""}
      ${mode === "signin" ? `<button class="btn btn-secondary btn-block" data-mode="signup">Create a free account</button>` : ""}
      <button class="btn btn-ghost btn-block" id="au-demo">Watch the live demo — no account needed</button>
      ${mode !== "magic" ? `<button class="btn btn-ghost btn-block" data-mode="magic">Email me a sign-in link instead</button>` : ""}
      ${mode === "magic" ? `<button class="btn btn-ghost btn-block" data-mode="signin">Use a password instead</button>` : ""}
      ${mode === "signup" ? `<button class="btn btn-ghost btn-block" data-mode="signin">Already have an account? Sign in</button>` : ""}
    </div>
    <p class="t-small t-secondary" style="text-align:center;margin-top:18px">
      Your budget stays on this device (or syncs everywhere with Premium). Your account stores your profile, points, and groups.
    </p>
  </div>`;

  if (TURNSTILE_ENABLED) renderCaptcha(view);

  view.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => { mode = b.dataset.mode; renderAuth(view); }));

  view.querySelector("#au-demo").addEventListener("click", startDemo);

  view.querySelector("#au-google")?.addEventListener("click", async () => {
    try { await signInWithGoogle(); } catch (e) { toast(friendly(e)); }
  });

  view.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = view.querySelector("#au-submit");
    const email = view.querySelector("#au-email").value.trim();

    if (TURNSTILE_ENABLED && !captchaToken) {
      toast("Please complete the verification above");
      return;
    }

    btn.disabled = true;
    showLoader(mode === "signup" ? "Building your den…" : mode === "magic" ? "Sending your link…" : "Signing you in…");
    try {
      if (mode === "magic") {
        await sendMagicLink(email, captchaToken);
        hideLoader();
        view.querySelector(".auth-hero p").textContent = "Link sent — check your email and tap it on this device.";
        toast("Sign-in link sent");
        btn.textContent = "Link sent ✓";
        return;
      }
      const pass = view.querySelector("#au-pass").value;
      if (mode === "signup") {
        const name = view.querySelector("#au-name").value.trim();
        const res = await signUp(email, pass, name, captchaToken);
        if (res.user && !res.session) {
          // email confirmation is enabled in the Supabase project
          hideLoader();
          view.querySelector(".auth-hero p").textContent = "Almost there — confirm via the email we just sent, then sign in.";
          toast("Check your email to confirm");
          mode = "signin";
          setTimeout(() => renderAuth(view), 1600);
          return;
        }
      } else {
        await signIn(email, pass, captchaToken);
      }
      // Coming from the demo? The sample budget, points, and achievements are
      // Sam's, not theirs — wipe local state so nothing fake becomes real, and
      // make sure zero demo points migrate to the cloud.
      const fromDemo = get().profile.demo;
      if (fromDemo) {
        resetAll();
        update((s) => { s.settings.pointsMigrated = true; });
      }
      onSignedIn(); // syncs points with the cloud (and migrates genuine local points once)
      hideLoader();
      toast(mode === "signup" ? "Welcome to Budget Bear" : "Signed in");
      if (fromDemo) {
        sessionStorage.removeItem("bb.authNext");
        navigate("/onboarding"); // build their real budget from scratch
      } else {
        navigate(consumeAuthNext());
      }
    } catch (err) {
      hideLoader();
      toast(friendly(err));
      btn.disabled = false;
      // Turnstile tokens are single-use — refresh the widget so retry can succeed.
      if (TURNSTILE_ENABLED && window.turnstile && captchaWidgetId != null) {
        window.turnstile.reset(captchaWidgetId);
      }
    }
  });
}

async function startDemo() {
  const s = get();
  if (s.profile.onboarded && !s.profile.demo) {
    const ok = await confirmSheet({
      title: "Replace saved data?",
      body: "This device already has a budget on it. The demo will replace it. Sign in instead to keep your data.",
      confirmLabel: "Show me the demo anyway",
      danger: true,
    });
    if (!ok) return;
  }
  showLoader("Setting up the demo…");
  applyDemoSeed();
  setTimeout(() => { hideLoader(); navigate("/home"); }, 500);
}

function friendly(err) {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Email or password doesn't match.";
  if (m.includes("already registered")) return "That email already has an account — sign in instead.";
  if (m.includes("rate limit")) return "Too many attempts — wait a minute and try again.";
  if (m.includes("captcha")) return "Verification failed — please try the checkbox again.";
  if (m.includes("network") || m.includes("fetch")) return "Can't reach the server. Check your connection.";
  return err?.message || "Something went wrong. Try again.";
}
