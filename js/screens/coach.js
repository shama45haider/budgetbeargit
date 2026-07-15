/* Budget Bear — AI Coach chat screen.
   Tries the real AI (Groq, via Supabase Edge Function) first when signed in;
   silently falls back to the instant local engine on any failure — offline,
   quota hit, or a server hiccup. The user never sees a broken state. */

import { esc } from "../format.js";
import { ask, starterChips, buildContext } from "../engine/coach.js";
import { get } from "../store.js";
import { currentUser } from "../cloud/client.js";
import { askAI, aiConfigured } from "../cloud/ai.js";

let history = []; // { role: "user"|"coach", html }

export function renderCoach(view) {
  view.innerHTML = `
  <div class="screen coach-screen">
    <header class="screen-header">
      <h1>Coach</h1>
      <span class="sub">Advice from your real numbers</span>
    </header>
    <div class="coach-chat" id="coach-chat" aria-live="polite"></div>
    <div class="coach-chips chip-row" id="coach-chips"></div>
    <form class="coach-inputbar" id="coach-form">
      <input class="input" id="coach-input" placeholder="Ask anything — “Can I afford $200?”" autocomplete="off">
      <button class="btn btn-primary" aria-label="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </form>
  </div>`;

  const chat = view.querySelector("#coach-chat");

  if (!history.length) {
    const name = get().profile.name;
    const smart = currentUser() && aiConfigured();
    history.push({
      role: "coach",
      html: `<p>${name ? `Hi ${esc(name)}. ` : ""}I'm your financial coach. I read your actual budget, goals, and bills${smart ? " and think it through for real" : ""} — so my answers come with reasoning, not guesses.</p>`,
      chips: starterChips,
    });
  }

  paint(chat, view);

  view.querySelector("#coach-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = view.querySelector("#coach-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    handle(text, chat, view);
  });
}

function paint(chat, view) {
  chat.innerHTML = history.map((m) => m.role === "user"
    ? `<div class="ob-bubble me"><div class="ob-msg">${m.html}</div></div>`
    : `<div class="ob-bubble bear"><img class="ob-avatar" src="assets/bears/thinkbear.png" alt=""><div class="ob-msg">${m.html}</div></div>`
  ).join("");
  const last = history[history.length - 1];
  const chipsEl = view.querySelector("#coach-chips");
  chipsEl.innerHTML = (last?.chips || [])
    .map((c) => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("");
  chipsEl.querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => handle(b.dataset.q, chat, view)));
  chat.scrollTop = chat.scrollHeight;
}

async function handle(text, chat, view) {
  history.push({ role: "user", html: esc(text) });
  paint(chat, view);

  const typing = document.createElement("div");
  typing.className = "ob-bubble bear";
  typing.innerHTML = `<img class="ob-avatar" src="assets/bears/thinkbear.png" alt="">
    <div class="ob-msg typing"><span></span><span></span><span></span></div>`;
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;

  let result = null;

  if (currentUser() && aiConfigured()) {
    try {
      const { reply } = await askAI(text, buildContext());
      result = { html: `<p>${esc(reply).replace(/\n/g, "<br>")}</p>`, chips: starterChips };
    } catch {
      result = null; // any failure (offline, quota, server) — fall through silently
    }
  }

  if (!result) {
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 300)); // keep the natural chat pacing
    result = ask(text);
  }

  history.push({ role: "coach", html: result.html, chips: result.chips });
  if (history.length > 60) history = history.slice(-60);
  paint(chat, view);
}
