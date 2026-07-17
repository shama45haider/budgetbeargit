/* Budget Bear — achievement definitions.
   Each achievement maps to a mascot pose. Checks run against current state. */

export const ACHIEVEMENTS = [
  {
    id: "first-plan",
    title: "The Plan Begins",
    desc: "You built your first budget. Every good decision starts with a plan.",
    bear: "thinkbear.png",
    points: 50,
    check: (s) => s.profile.onboarded,
  },
  {
    id: "first-goal",
    title: "Eyes on the Prize",
    desc: "You created your first savings goal.",
    bear: "pointbear.png",
    points: 40,
    check: (s) => s.goals.length > 0,
  },
  {
    id: "first-100",
    title: "First $100 Saved",
    desc: "One hundred dollars closer to what matters.",
    bear: "coinbear.png",
    points: 60,
    check: (s) => s.goals.reduce((a, g) => a + g.saved, 0) >= 100,
  },
  {
    id: "first-1000",
    title: "Four Figures",
    desc: "You've saved $1,000 toward your goals. That's real momentum.",
    bear: "coinbear.png",
    points: 150,
    check: (s) => s.goals.reduce((a, g) => a + g.saved, 0) >= 1000,
  },
  {
    id: "goal-complete",
    title: "Goal Reached",
    desc: "You finished a goal you set for yourself. Well earned.",
    bear: "excitedbear.png",
    points: 200,
    check: (s) => s.goals.some((g) => g.completedAt || (g.target > 0 && g.saved >= g.target)),
  },
  {
    id: "streak-3",
    title: "Three-Day Habit",
    desc: "Three daily check-ins in a row. Habits are how budgets survive.",
    bear: "pointbear.png",
    points: 30,
    check: (s) => s.points.streak >= 3 || s.points.bestStreak >= 3,
  },
  {
    id: "streak-7",
    title: "One Full Week",
    desc: "Seven days of showing up for your money.",
    bear: "excitedbear.png",
    points: 80,
    check: (s) => s.points.streak >= 7 || s.points.bestStreak >= 7,
  },
  {
    id: "streak-30",
    title: "The Thirty",
    desc: "A month of daily consistency. Very few people do this.",
    bear: "graphbear.png",
    points: 300,
    check: (s) => s.points.streak >= 30 || s.points.bestStreak >= 30,
  },
  {
    id: "under-budget-month",
    title: "Under Budget",
    desc: "You closed a month with spending under plan across the board.",
    bear: "graphbear.png",
    points: 120,
    // Looks at the last COMPLETE month: every budgeted category at or under its
    // limit. (This read `s.pointsFlags?.underBudgetMonth` — a key nothing in the
    // app ever wrote, so the achievement could never unlock while still counting
    // toward the total, making 100% impossible.)
    check: (s) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cats = s.budget.categories.filter((c) => c.id !== "savings" && c.limit > 0);
      if (!cats.length) return false;
      const monthTx = s.transactions.filter((t) => t.date.slice(0, 7) === mk && t.categoryId !== "savings");
      if (!monthTx.length) return false; // no activity isn't an achievement
      return cats.every((c) => {
        const spent = monthTx.filter((t) => t.categoryId === c.id).reduce((a, t) => a + t.amount, 0);
        return spent <= c.limit;
      });
    },
  },
  {
    id: "tracker-10",
    title: "Ten Transactions",
    desc: "Ten expenses logged. What gets tracked gets managed.",
    bear: "thinkbear.png",
    points: 30,
    check: (s) => s.transactions.length >= 10,
  },
  {
    id: "points-500",
    title: "500 Club",
    desc: "You've earned 500 Bear Points.",
    bear: "coinbear.png",
    points: 0,
    check: (s) => s.points.balance >= 500,
  },
];

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
