/* Budget Bear — Premium cloud budget sync.
   Free and demo accounts stay exactly as before: budget data lives only in
   localStorage. A Premium account additionally mirrors it to one row in
   Supabase (budget_backups), so opening the app on a second device restores
   the same budget instead of starting fresh.

   Deliberately scoped to the FIELDS below — points and achievements already
   have their own, more precise cloud sync (server-authoritative RPCs in
   engine/points.js) and must never be overwritten by a stale snapshot. */

import { get, update, subscribe } from "../store.js";
import { currentUser, isPremium } from "../cloud/client.js";
import { fetchBudgetBackup, pushBudgetBackup } from "../cloud/api.js";
import { openSheet, toast } from "../ui/components.js";

const FIELDS = ["profile", "income", "budget", "transactions", "bills", "goals", "debts", "habits"];

function snapshotOf(s) {
  const out = {};
  for (const k of FIELDS) out[k] = s[k];
  out.settings = { savingsBuffer: s.settings.savingsBuffer };
  return out;
}

function applySnapshot(remote) {
  update((s) => {
    for (const k of FIELDS) if (remote[k] !== undefined) s[k] = remote[k];
    if (remote.settings) s.settings.savingsBuffer = remote.settings.savingsBuffer ?? s.settings.savingsBuffer;
  });
}

function hasRealBudget(s) {
  return !!(s?.profile?.onboarded && !s?.profile?.demo);
}

let reconciledForUser = null;
let pushTimer = null;
let lastPushedJSON = null;

async function pushNow() {
  if (!currentUser() || !isPremium()) return;
  // "Start over" (profile.js) promises local reset never touches the cloud
  // copy or other devices — never let a blanked-out local state overwrite a
  // real cloud backup. (reconcileOnSignIn's own pushes are already guarded by
  // localHasData before calling this; this covers the ambient debounced push.)
  if (!hasRealBudget(get())) return;
  const snap = snapshotOf(get());
  const json = JSON.stringify(snap);
  if (json === lastPushedJSON) return;
  await pushBudgetBackup(snap); // throws on failure — callers decide how to handle it
  lastPushedJSON = json;
  update((s) => { s.settings.cloudLastSyncedAt = new Date().toISOString(); });
}

/** Which copy to keep when both this device and the cloud have real, different
    budgets. Dismissing the sheet defaults to "keep this device" — the one
    choice that can never silently discard something. */
function chooseBudgetSource() {
  return new Promise((resolve) => {
    openSheet(`
      <h2 class="sheet-title">Two budgets found</h2>
      <p class="t-secondary" style="margin-bottom:20px">
        This device and your Budget Bear cloud both have a saved budget. Which one should we keep?</p>
      <div class="stack">
        <button class="btn btn-primary btn-block" data-act="cloud">Use my synced budget</button>
        <button class="btn btn-secondary btn-block" data-act="local">Keep this device's budget</button>
      </div>
    `, {
      onOpen(sheet, close) {
        sheet.querySelector('[data-act="cloud"]').onclick = () => { resolve("cloud"); close(); };
        sheet.querySelector('[data-act="local"]').onclick = () => { resolve("local"); close(); };
      },
      onClose() { resolve("local"); },
    });
  });
}

/** Call once per sign-in, after the profile (and so isPremium()) is known —
    idempotent per user per session. No-op for free, demo, or signed-out. */
export async function reconcileOnSignIn() {
  const user = currentUser();
  if (!user || !isPremium()) return;
  if (reconciledForUser === user.id) return;
  reconciledForUser = user.id;

  let remote;
  try { remote = await fetchBudgetBackup(); } catch { return; } // offline — the next boot tries again

  const local = get();
  const localHasData = hasRealBudget(local);
  const cloudHasData = !!remote?.data && hasRealBudget(remote.data);

  try {
    if (!cloudHasData) {
      if (localHasData) await pushNow();
      return;
    }
    if (!localHasData) {
      applySnapshot(remote.data);
      lastPushedJSON = JSON.stringify(remote.data);
      update((s) => { s.settings.cloudLastSyncedAt = remote.updated_at; });
      toast("Synced your budget from the cloud");
      return;
    }
    if (JSON.stringify(snapshotOf(local)) === JSON.stringify(remote.data)) {
      lastPushedJSON = JSON.stringify(remote.data);
      return; // already in sync
    }

    const choice = await chooseBudgetSource();
    if (choice === "cloud") {
      applySnapshot(remote.data);
      lastPushedJSON = JSON.stringify(remote.data);
      update((s) => { s.settings.cloudLastSyncedAt = remote.updated_at; });
      toast("Synced your budget from the cloud");
    } else {
      await pushNow();
    }
  } catch { /* offline mid-reconcile — next boot retries from scratch */ }
}

/** Debounced push on every local change, Premium accounts only. Registered
    once at module load — importing this module anywhere wires it up. */
subscribe(() => {
  if (!currentUser() || !isPremium()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow().catch(() => {}), 2500);
});

/** Manual "Sync now" for the Profile screen. */
export async function syncNowManual() {
  if (!currentUser() || !isPremium()) return { error: "not_premium" };
  try {
    await pushNow();
    return { ok: true };
  } catch (err) {
    return { error: err?.message || "sync_failed" };
  }
}
