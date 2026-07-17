/* Budget Bear — Bear Points, streaks, and achievement unlocking.
   Signed in: the cloud balance (profiles.points) is the source of truth so
   the Shop can't be cheated and friends can see what you've earned. Local
   bb.points mirrors it for instant display. Demo mode stays fully local. */

import { get, update, uid } from "../store.js";
import { todayISO, parseISO } from "../format.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { showAchievement } from "../ui/achievement.js";
import { toast } from "../ui/components.js";
import { currentUser, loadMyProfile, myProfile } from "../cloud/client.js";
import { earnPoints } from "../cloud/api.js";

/* ---------- cloud earn queue ----------
   The server decides what every award is worth (schema.sql V8) — we send the
   REASON, not an amount. A check-in that also unlocks achievements fires
   several distinct awards at once, and earn_points allows one call per second,
   so events queue and flush serially rather than being summed together. */

const pending = [];   // { reason, ref, amount }
let flushTimer = null;

function queueCloudEarn(reason, ref = null, amount = null) {
  if (!currentUser()) return; // demo mode stays fully local
  pending.push({ reason, ref, amount });
  if (!flushTimer) flushTimer = setTimeout(flush, 400); // coalesce the initial burst
}

async function flush() {
  const ev = pending[0];
  if (!ev) { flushTimer = null; return; }
  let retry = false;
  try {
    const res = await earnPoints(ev.reason, ev.ref, ev.amount);
    if (res?.error === "too_fast") {
      retry = true; // rate guard — keep it queued
    } else {
      pending.shift();
      if (res?.ok) {
        update((s) => {
          s.points.balance = res.points;              // server balance is the truth
          if (typeof res.streak === "number" && res.streak > 0) {
            s.points.streak = res.streak;             // streak is server-owned now
            s.points.bestStreak = res.best_streak ?? s.points.bestStreak;
          }
        });
      }
      // Any other { error } (already_awarded, daily_cap, already_checked_in) is
      // the server correctly refusing a duplicate — drop it, don't retry.
    }
  } catch {
    // Offline or transport failure. Drop the queue rather than spin: the local
    // mirror already shows the points, and the next award reconciles the balance.
    pending.length = 0;
  }
  flushTimer = pending.length ? setTimeout(flush, retry ? 1200 : 1100) : null;
}

/** After sign-in: one-time migration of local points, then mirror the cloud balance. */
export function onSignedIn() {
  const s = get();
  if (!s.settings.pointsMigrated) {
    const credit = Math.min(2000, Math.max(0, Math.round(s.points.balance)));
    update((st) => { st.settings.pointsMigrated = true; });
    if (credit > 0) queueCloudEarn("migration", null, credit);
  }
  // Pull the authoritative balance once the profile is loaded.
  loadMyProfile().then((p) => {
    if (p) update((st) => { st.points.balance = p.points ?? st.points.balance; });
  }).catch(() => {});
}

/** Cloud lifetime points (drives levels); falls back to local balance in demo. */
export function lifetimePoints() {
  return myProfile()?.lifetime_points ?? get().points.balance;
}

/* ---------- awards ---------- */

function awardLocal(reason, amount) {
  update((s) => {
    s.points.balance += amount;
    s.points.history.unshift({ id: uid(), reason, amount, date: todayISO() });
    if (s.points.history.length > 200) s.points.history.length = 200;
  });
}

export function hasCheckedInToday() {
  return get().habits.lastCheckIn === todayISO();
}

/** Daily check-in: maintains streak, awards points. Returns points earned or 0. */
export function dailyCheckIn() {
  if (hasCheckedInToday()) return 0;
  const today = todayISO();
  let earned = 25;

  update((s) => {
    const last = s.habits.lastCheckIn;
    if (last) {
      const gap = Math.round((parseISO(today) - parseISO(last)) / 86400000);
      s.points.streak = gap === 1 ? s.points.streak + 1 : 1;
    } else {
      s.points.streak = 1;
    }
    s.points.bestStreak = Math.max(s.points.bestStreak, s.points.streak);
    s.habits.lastCheckIn = today;
    s.habits.checkIns.push(today);
    if (s.habits.checkIns.length > 400) s.habits.checkIns.shift();

    // streak bonus every 7 days
    if (s.points.streak > 0 && s.points.streak % 7 === 0) earned += 75;

    s.points.balance += earned;
    s.points.history.unshift({ id: uid(), reason: "Daily check-in", amount: earned, date: today });
  });

  queueCloudEarn("daily_checkin");
  checkAchievements();
  return earned;
}

/** Evaluate all achievement rules; unlock + celebrate any new ones. */
export function checkAchievements() {
  const s = get();
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.unlocked[a.id]) continue;
    let ok = false;
    try { ok = a.check(s); } catch { ok = false; }
    if (ok) newly.push(a);
  }
  if (!newly.length) return;

  update((st) => {
    for (const a of newly) {
      st.achievements.unlocked[a.id] = todayISO();
      if (a.points) {
        st.points.balance += a.points;
        st.points.history.unshift({ id: uid(), reason: a.title, amount: a.points, date: todayISO() });
      }
    }
  });
  for (const a of newly) queueCloudEarn("achievement", a.id);
  for (const a of newly) showAchievement(a);
}

/** Award for goal contribution — called by goal screens. */
export function awardContribution(amount) {
  const pts = Math.min(100, Math.max(10, Math.round(amount / 5)));
  awardLocal("Goal contribution", pts);
  queueCloudEarn("goal_contribution", null, pts);
  checkAchievements();
  toast(`+${pts} Bear Points`);
}
