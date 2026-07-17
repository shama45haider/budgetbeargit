/* Budget Bear — Supabase client + session state.
   The vendored UMD build (js/vendor/supabase.js) exposes window.supabase. */

import { SUPABASE_URL, SUPABASE_ANON_KEY, cloudConfigured } from "./config.js";

let client = null;
let session = null;
let profile = null;

const listeners = new Set();

export function cloudReady() {
  return cloudConfigured() && !!window.supabase;
}

export function getClient() {
  if (!client && cloudReady()) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export function currentSession() { return session; }
export function currentUser() { return session?.user || null; }
export function myProfile() { return profile; }

/** Client-side mirror of the server's is_premium(). Only ever gates UI — every
    real limit is enforced by is_premium() inside the RPC. Re-reads the loaded
    profile each call, so a lapse takes effect on the next loadMyProfile(). */
export function isPremium() {
  const p = profile;
  if (!p || (p.plan !== "premium" && p.plan !== "business")) return false;
  return !p.plan_expires_at || new Date(p.plan_expires_at) > new Date();
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn({ session, profile });
}

/** Boot: restore session and profile; subscribe to auth events. */
export async function initCloud() {
  const c = getClient();
  if (!c) return;
  const { data } = await c.auth.getSession();
  session = data.session;
  if (session) await loadMyProfile();
  c.auth.onAuthStateChange(async (_event, s) => {
    const hadSession = !!session;
    session = s;
    if (session && !profile) await loadMyProfile();
    if (!session) profile = null;
    if (hadSession !== !!session || _event === "USER_UPDATED") notify();
    else notify();
  });
  notify();
}

export async function loadMyProfile() {
  const c = getClient();
  const user = currentUser();
  if (!c || !user) return null;
  const { data } = await c.from("profiles").select("*").eq("id", user.id).maybeSingle();
  profile = data;
  return profile;
}

/* ---------- Auth actions ---------- */

export async function signUp(email, password, displayName, captchaToken) {
  const c = getClient();
  const { data, error } = await c.auth.signUp({
    email, password,
    options: { data: { display_name: displayName }, captchaToken },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password, captchaToken) {
  const c = getClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password, options: { captchaToken } });
  if (error) throw error;
  return data;
}

export async function sendMagicLink(email, captchaToken) {
  const c = getClient();
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname, captchaToken },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const c = getClient();
  const { error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const c = getClient();
  await c.auth.signOut();
  session = null;
  profile = null;
  notify();
}

export async function updatePassword(newPassword) {
  const c = getClient();
  const { error } = await c.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Sends a confirmation link to the new address; the change applies after they click it. */
export async function updateEmail(newEmail) {
  const c = getClient();
  const { error } = await c.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

/** Deletes the auth user server-side (cascades to all app data), then clears the local session. */
export async function deleteAccount() {
  const c = getClient();
  const { error } = await c.rpc("delete_account");
  if (error) throw error;
  await c.auth.signOut().catch(() => {}); // the user row is gone; local cleanup only
  session = null;
  profile = null;
  notify();
}

/* ---------- Profile updates ---------- */

/** Cosmetic profile fields only. The `authenticated` role holds column-level
    UPDATE grants covering exactly these (see schema.sql V8) — points, plan,
    equipped, quota counters and avatar_url are writable only by definer RPCs.
    updated_at is maintained by a trigger; sending it now fails on permission. */
const PROFILE_EDITABLE = [
  "display_name", "banner_color", "accent_color",
  "about", "pronouns", "status_emoji", "status_text",
];

export async function updateProfile(fields) {
  const c = getClient();
  const user = currentUser();
  if (!c || !user) throw new Error("Not signed in");
  const safe = {};
  for (const k of PROFILE_EDITABLE) if (k in fields) safe[k] = fields[k];
  const { data, error } = await c.from("profiles")
    .update(safe)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  profile = data;
  notify();
  return data;
}

export async function uploadAvatar(file) {
  const c = getClient();
  const user = currentUser();
  if (!c || !user) throw new Error("Not signed in");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await c.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = c.storage.from("avatars").getPublicUrl(path);
  // cache-bust since the path is stable across uploads
  const url = data.publicUrl + "?v=" + Date.now();
  const res = await c.rpc("set_avatar_url", { p_url: url });
  if (res.error) throw res.error;
  if (res.data?.error) throw new Error(res.data.error);
  await loadMyProfile();
  notify();
  return url;
}

/** Upload a custom category image (Premium). The storage policy enforces the
    plan server-side; a non-premium upload fails there, not here. Returns the
    public URL to store on the local category. */
export async function uploadCategoryImage(categoryId, file) {
  const c = getClient();
  const user = currentUser();
  if (!c || !user) throw new Error("Not signed in");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${categoryId}.${ext}`;
  const { error } = await c.storage.from("category-images").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = c.storage.from("category-images").getPublicUrl(path);
  return data.publicUrl + "?v=" + Date.now();
}

/** Clear the avatar (the file stays; the profile stops pointing at it). */
export async function clearAvatar() {
  const c = getClient();
  if (!currentUser()) throw new Error("Not signed in");
  const { data, error } = await c.rpc("set_avatar_url", { p_url: null });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await loadMyProfile();
  notify();
}
