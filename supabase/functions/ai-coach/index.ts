// Budget Bear — AI Coach edge function.
// Proxies chat messages to Groq (free tier, Llama 3.3 70B) so the API key
// never touches the browser. Enforces a server-side daily quota per user
// via the use_ai_message RPC (see supabase/schema.sql, "V5: AI COACH").
//
// Deploy via Supabase Dashboard → Edge Functions → Create a new function
// named "ai-coach", paste this file, Deploy. Then set the GROQ_API_KEY
// secret (Dashboard → Edge Functions → Manage secrets). Full steps in
// SETUP-SUPABASE.md.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const DAILY_LIMIT = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PREAMBLE = `You are the Budget Bear Coach — a calm, plain-spoken financial advisor built \
into a budgeting app called Budget Bear. Rules:
- Use simple, 3rd-grade-friendly language. Never use jargon like "unallocated" or "liquidity" — say \
"money left over" instead. Avoid big words generally.
- Reason from the user's real numbers given below. Always explain WHY, don't just answer yes/no.
- You are not a licensed financial advisor and must not give speculative stock picks, tax/legal advice, \
or guarantee investment returns. For anything outside personal budgeting (medical, legal, unrelated \
topics, or anything harmful), politely redirect back to money questions.
- Keep answers concise — a few short sentences or a tight list. This is a mobile chat, not an essay.
- Be encouraging but honest. Never shame the user about their spending.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "not_signed_in" }, 401);
    if (!GROQ_API_KEY) return json({ error: "not_configured" }, 500);

    let body: { message?: string; context?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad_request" }, 400);
    }
    const message = (body.message || "").trim();
    const context = (body.context || "").slice(0, 4000);
    if (!message || message.length > 1000) return json({ error: "bad_request" }, 400);

    // RLS-scoped client: the incoming user JWT is forwarded, so this RPC
    // runs (and rate-limits) as that specific user — no service role needed.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: quota, error: quotaErr } = await supabase.rpc("use_ai_message", {
      p_daily_limit: DAILY_LIMIT,
    });
    if (quotaErr) return json({ error: "not_signed_in" }, 401);
    if (quota?.error === "quota_exceeded") {
      return json({ error: "quota_exceeded", limit: quota.limit }, 429);
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: `${SYSTEM_PREAMBLE}\n\nThe user's current numbers:\n${context}` },
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => "");
      return json({ error: "upstream_error", detail: detail.slice(0, 300) }, 502);
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ error: "empty_reply" }, 502);

    return json({ reply, remaining: quota.remaining });
  } catch (e) {
    return json({ error: "server_error", detail: String(e).slice(0, 200) }, 500);
  }
});
