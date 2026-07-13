/* Budget Bear — Bear Points, streaks, and achievement unlocking. */

import { get, update, uid } from "../store.js";
import { todayISO, parseISO } from "../format.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { showAchievement } from "../ui/achievement.js";
import { toast } from "../ui/components.js";

export function award(reason, amount) {
  update((s) => {
    s.points.balance += amount;
    s.points.history.unshift({ id: uid(), reason, amount, date: todayISO() });
    if (s.points.history.length > 200) s.points.history.length = 200;
  });
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
  for (const a of newly) showAchievement(a);
}

/** Award for goal contribution — called by goal screens. */
export function awardContribution(amount) {
  const pts = Math.min(50, Math.max(5, Math.round(amount / 10)));
  award("Goal contribution", pts);
  toast(`+${pts} Bear Points`);
}
