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
   The earn_points RPC allows one call per 3s (abuse guard). A check-in that
   also unlocks achievements fires several awards at once, so we coalesce
   pending amounts and flush them serially. */

let pendingCloud = 0;
let flushTimer = null;

function queueCloudEarn(amount, reason) {
  if (!currentUser()) return;
  pendingCloud += amount;
  if (flushTimer) return;
  flushTimer = setTimeout(flushCloudEarns, 400); // small window to coalesce bursts
  async function flushCloudEarns() {
    const send = Math.min(300, pendingCloud);
    pendingCloud -= send;
    try {
      const balance = await earnPoints(send, reason);
      update((s) => { s.points.balance = balance; }); // mirror server truth
    } catch (err) {
      if ((err?.message || "").includes("too_fast")) {
        pendingCloud += send; // rate-guarded — retry on the next tick
      } else {
        pendingCloud = 0; // offline etc. — local mirror keeps the points for now
      }
    }
    flushTimer = pendingCloud > 0 ? setTimeout(flushCloudEarns, 3400) : null;
  }
}

/** After sign-in: one-time migration of local points, then mirror the cloud balance. */
export function onSignedIn() {
  const s = get();
  if (!s.settings.pointsMigrated) {
    const credit = Math.min(2000, Math.max(0, Math.round(s.points.balance)));
    update((st) => { st.settings.pointsMigrated = true; });
    if (credit > 0) queueCloudEarn(credit, "Welcome migration");
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

export function award(reason, amount) {
  update((s) => {
    s.points.balance += amount;
    s.points.history.unshift({ id: uid(), reason, amount, date: todayISO() });
    if (s.points.history.length > 200) s.points.history.length = 200;
  });
  queueCloudEarn(amount, reason);
  checkAchievements();
}

export function hasCheckedInToday() {
  return get().habits.lastCheckIn === todayISO();
}

/** Daily check-in: maintains streak, awards points. Returns points earned or 0. */
export function dailyCheckIn() {
  if (hasCheckedInToday()) return 0;
  const today = todayISO();
  let earned = 10;

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
    if (s.points.streak > 0 && s.points.streak % 7 === 0) earned += 25;

    s.points.balance += earned;
    s.points.history.unshift({ id: uid(), reason: "Daily check-in", amount: earned, date: today });
  });

  queueCloudEarn(earned, "Daily check-in");
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

  let cloudTotal = 0;
  update((st) => {
    for (const a of newly) {
      st.achievements.unlocked[a.id] = todayISO();
      if (a.points) {
        st.points.balance += a.points;
        st.points.history.unshift({ id: uid(), reason: a.title, amount: a.points, date: todayISO() });
        cloudTotal += a.points;
      }
    }
  });
  if (cloudTotal > 0) queueCloudEarn(cloudTotal, "Achievements");
  for (const a of newly) showAchievement(a);
}

/** Award for goal contribution — called by goal screens. */
export function awardContribution(amount) {
  const pts = Math.min(50, Math.max(5, Math.round(amount / 10)));
  award("Goal contribution", pts);
  toast(`+${pts} Bear Points`);
}
