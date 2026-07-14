/* Budget Bear — group-only achievements + daily group tips.
   All checks are pure functions over { group, members, contributions } so
   any client can detect an unlock; the database keeps it idempotent. */

import { money } from "../format.js";

/* ---------- Group achievements ---------- */

export const GROUP_ACHIEVEMENTS = [
  {
    id: "squad-up",
    title: "Squad Assembled",
    desc: "Three or more savers in the group. It's officially a team.",
    bear: "happybear.png",
    check: ({ members }) => members.length >= 3,
  },
  {
    id: "liftoff",
    title: "Liftoff",
    desc: "The group's first $100 saved together.",
    bear: "coin2bear.png",
    check: ({ members }) => total(members) >= 100,
  },
  {
    id: "first-grand",
    title: "The First Grand",
    desc: "$1,000 saved as a group. Real money, real momentum.",
    bear: "achievementbear.png",
    check: ({ members }) => total(members) >= 1000,
  },
  {
    id: "halfway",
    title: "Halfway There",
    desc: "The group crossed 50% of its goal.",
    bear: "graphbear.png",
    check: ({ group, members }) => goalTarget(group, members) > 0 && total(members) >= goalTarget(group, members) / 2,
  },
  {
    id: "goal-reached",
    title: "Goal Reached",
    desc: "You did it — together. Time to book it.",
    bear: "excitedbear.png",
    check: ({ group, members }) => goalTarget(group, members) > 0 && total(members) >= goalTarget(group, members),
  },
  {
    id: "perfect-week",
    title: "Perfect Week",
    desc: "Every member contributed within the same 7 days.",
    bear: "pointbear2.png",
    check: ({ members, contributions }) => {
      if (members.length < 2) return false;
      const weekAgo = Date.now() - 7 * 86400000;
      const recent = new Set(contributions.filter((c) => new Date(c.at).getTime() >= weekAgo).map((c) => c.userId));
      return members.every((m) => recent.has(m.userId));
    },
  },
  {
    id: "heavy-lifter",
    title: "Heavy Lifter",
    desc: "A member hit their full personal target.",
    bear: "graphbear.png",
    check: ({ group, members }) => members.some((m) => m.saved >= Number(group.per_person)),
  },
  {
    id: "photo-finish",
    title: "Photo Finish",
    desc: "Goal reached before the target date.",
    bear: "excitedbear.png",
    check: ({ group, members }) => {
      if (!group.target_date) return false;
      const t = goalTarget(group, members);
      return t > 0 && total(members) >= t && new Date() < new Date(group.target_date + "T23:59");
    },
  },
];

function total(members) {
  return members.reduce((a, m) => a + m.saved, 0);
}

export function goalTarget(group, members) {
  return Number(group.per_person) * Math.max(1, members.length);
}

export function groupAchievementById(id) {
  return GROUP_ACHIEVEMENTS.find((a) => a.id === id);
}

/* ---------- Daily group tip ---------- */

/** Deterministic per-day pick among applicable tips, so everyone sees the same tip. */
export function dailyTip({ group, members, myUserId }) {
  const t = total(members);
  const target = goalTarget(group, members);
  const remaining = Math.max(0, target - t);
  const me = members.find((m) => m.userId === myUserId);
  const leader = members[0];
  const per = Number(group.per_person);

  const daysLeft = group.target_date
    ? Math.max(0, Math.ceil((new Date(group.target_date + "T12:00") - new Date()) / 86400000))
    : null;

  const tips = [];

  if (remaining === 0) {
    tips.push(`Goal complete. Anything extra is cushion for the trip itself — surprises get cheaper when they're pre-funded.`);
  } else {
    if (daysLeft && daysLeft > 0) {
      const perDayEach = remaining / members.length / daysLeft;
      tips.push(`If each of you sets aside ${money(perDayEach)} a day, you hit the goal right on time.`);
      const perDayFaster = remaining / members.length / Math.max(1, daysLeft - 14);
      if (daysLeft > 21) tips.push(`Add ${money(perDayFaster - perDayEach)} more per day each and you'd finish two weeks early.`);
      if (daysLeft <= 14) tips.push(`${daysLeft} days left. A no-dining-out week saves most people ${money(40)}–${money(60)} — enough to close a gap fast.`);
    }
    if (me && leader && leader.userId !== me.userId) {
      const gap = leader.saved - me.saved;
      if (gap > 0) tips.push(`You're ${money(gap)} behind ${leader.name}. One skipped takeout order a week closes that in about a month.`);
    }
    if (me && me.saved < per * 0.25) {
      tips.push(`Fastest start: move ${money(Math.min(25, per * 0.05))} right after payday, before it can get spent.`);
    }
    if (remaining > 0 && remaining <= per * 0.5) {
      tips.push(`Only ${money(remaining)} to go as a group — one good week could finish this.`);
    }
    tips.push(`Auto-transfers beat willpower. Everyone scheduling ${money(Math.ceil(per / 20 / 5) * 5)} weekly gets there without thinking about it.`);
    tips.push(`Round-ups add up: rounding purchases to the next dollar typically saves ${money(20)}–${money(40)}/month per person.`);
  }

  // Deterministic index from date + group id
  const today = new Date();
  const seedStr = group.id + today.getFullYear() + "-" + today.getMonth() + "-" + today.getDate();
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return tips[h % tips.length];
}
