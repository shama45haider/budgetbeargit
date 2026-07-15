/* Budget Bear — real AI Coach client.
   Calls the ai-coach Supabase Edge Function (proxies to Groq, keeps the
   API key server-side). Always has a local fallback — see js/engine/coach.js
   ask(), which the Coach screen uses whenever this fails or quota runs out. */

import { getClient, currentUser } from "./client.js";
import { SUPABASE_URL, cloudConfigured } from "./config.js";

export function aiConfigured() {
  return cloudConfigured() && !!SUPABASE_URL;
}

/** Ask the real AI. Throws with a `.code` on failure (caller falls back). */
export async function askAI(message, context) {
  if (!currentUser()) { const e = new Error("not signed in"); e.code = "not_signed_in"; throw e; }

  const client = getClient();
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) { const e = new Error("no session"); e.code = "not_signed_in"; throw e; }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, context }),
      signal: controller.signal,
    });
  } catch (err) {
    const e = new Error("network");
    e.code = err.name === "AbortError" ? "timeout" : "network";
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok || data?.error) {
    const e = new Error(data?.error || "upstream_error");
    e.code = data?.error || "upstream_error";
    e.limit = data?.limit;
    throw e;
  }

  return { reply: data.reply, remaining: data.remaining };
}
