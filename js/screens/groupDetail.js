/* Budget Bear — Group detail: live leaderboard, contributions, feed, achievements, daily tip. */

import { esc, money, shortDate, todayISO } from "../format.js";
import { get, update, uid } from "../store.js";
import { currentUser } from "../cloud/client.js";
import * as api from "../cloud/api.js";
import { openSheet, toast, confirmSheet } from "../ui/components.js";
import { showAchievement } from "../ui/achievement.js";
import { GROUP_ACHIEVEMENTS, groupAchievementById, goalTarget, dailyTip } from "../data/groupExtras.js";
import { accentPickerHTML, bindAccentPicker } from "../data/accents.js";
import { avatarHTML, openShareSheet } from "./groups.js";
import { flairStyle, effectClass, tagHTML, levelFor } from "../data/shop.js";
import { awardContribution } from "../engine/points.js";
import { navigate } from "../router.js";
import { authNext } from "./auth.js";

let unsubscribe = null;
const shownUnlocks = new Set(); // avoid double overlays per session

export function renderGroupDetail(view, groupId) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  if (!currentUser()) {
    authNext("/group/" + groupId);
    navigate("/auth");
    return;
  }

  view.innerHTML = `
  <div class="screen" id="gd-root">
    <div class="skeleton" style="height:180px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:70px;margin-bottom:8px"></div>
    <div class="skeleton" style="height:70px;margin-bottom:8px"></div>
    <div class="skeleton" style="height:70px"></div>
  </div>`;

  const state = { group: null, members: [], contributions: [], achievements: {} };

  const load = async ({ animate = false } = {}) => {
    const prevPositions = animate ? capturePositions(view) : null;
    try {
      const [group, members, contributions, achievements] = await Promise.all([
        api.getGroup(groupId),
        api.groupMembers(groupId),
        api.recentContributions(groupId),
        api.groupAchievements(groupId),
      ]);
      if (!view.isConnected) return;
      if (!group) {
        view.innerHTML = `<div class="screen"><div class="empty-state" style="padding-top:60px">
          <img src="assets/bears/confusedbear.png" alt="">
          <h3>Group not found</h3><p>It may have been deleted, or you may have left it.</p></div>
          <button class="btn btn-secondary btn-block" onclick="location.hash='/groups'">Back to Groups</button></div>`;
        return;
      }
      Object.assign(state, { group, members, contributions, achievements });
      paint(view, state, load);
      if (prevPositions) playFLIP(view, prevPositions);
      const gotNewUnlocks = await detectUnlocks(state);
      if (gotNewUnlocks && view.isConnected) paint(view, state, load); // reflect newly-unlocked badges now, not on next load
      markSeen(state.achievements);
    } catch (e) {
      if (!view.isConnected) return;
      view.innerHTML = `<div class="screen"><div class="callout danger"><span>⚠️</span>
        <div>Couldn't load this group. ${esc(e.message || "Check your connection.")}</div></div></div>`;
    }
  };

  load();
  unsubscribe = api.subscribeGroup(groupId, () => load({ animate: true }));
}

/* ---------- painting ---------- */

function paint(view, state, reload) {
  const { group, members, contributions, achievements } = state;
  const me = currentUser();
  const total = members.reduce((a, m) => a + m.saved, 0);
  const target = goalTarget(group, members);
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const isOwner = group.created_by === me.id;
  const daysLeft = group.target_date
    ? Math.ceil((new Date(group.target_date + "T12:00") - new Date()) / 86400000)
    : null;
  const tip = dailyTip({ group, members, myUserId: me.id });

  view.innerHTML = `
  <div class="screen">
    <header class="gd-header">
      <button class="wizard-back" id="gd-back" aria-label="Back to groups">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <div class="grow"></div>
      <button class="btn btn-sm btn-secondary" id="gd-invite">Invite</button>
      <button class="wizard-back" id="gd-menu" aria-label="Group options">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
      </button>
    </header>

    <section class="card gd-hero">
      <div class="row">
        <div class="icon-bubble" style="width:52px;height:52px;border-radius:16px;font-size:24px">${group.icon}</div>
        <div class="grow">
          <h1 style="font-size:var(--fs-22)">${esc(group.name)}</h1>
          <div class="t-small t-secondary">
            ${money(Number(group.per_person))} each · ${members.length} member${members.length === 1 ? "" : "s"}
            ${daysLeft != null ? ` · ${daysLeft > 0 ? daysLeft + " days left" : daysLeft === 0 ? "today!" : Math.abs(daysLeft) + " days past target"}` : ""}
          </div>
        </div>
      </div>
      ${group.description ? `<p class="t-small t-secondary" style="margin-top:10px">${esc(group.description)}</p>` : ""}
      <div class="row" style="align-items:baseline;margin:14px 0 6px">
        <span class="t-num" style="font-size:var(--fs-26);font-weight:var(--fw-bold)">${money(total)}</span>
        <span class="t-small t-secondary grow">of ${money(target)} together</span>
        <strong class="t-num">${pct}%</strong>
      </div>
      <div class="progress" style="height:8px"><i style="width:${pct}%"></i></div>
    </section>

    <div class="card gd-tip">
      <div class="row" style="align-items:flex-start">
        <img src="assets/bears/thinkbear.png" alt="" width="38" height="38" style="flex-shrink:0">
        <div class="grow">
          <div class="coach-block-title" style="padding:0">Today's tip</div>
          <div style="font-size:var(--fs-14);margin-top:2px">${esc(tip)}</div>
        </div>
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="gd-add" style="margin-top:12px">Add savings</button>

    <h2 class="section-title">Ranking</h2>
    <div class="stack" id="gd-board" style="--gap:8px">
      ${members.map((m, i) => memberRow(m, i, group, me.id)).join("")}
    </div>

    <h2 class="section-title">Group achievements · ${Object.keys(achievements).length}/${GROUP_ACHIEVEMENTS.length}</h2>
    <div class="ach-grid">
      ${GROUP_ACHIEVEMENTS.map((a) => {
        const when = achievements[a.id];
        return `<button class="ach-tile ${when ? "" : "locked"}" data-gach="${a.id}">
          <img src="assets/bears/${a.bear}" alt=""><small>${esc(a.title)}</small>
        </button>`;
      }).join("")}
    </div>

    <h2 class="section-title">Activity</h2>
    <div class="list">
      ${contributions.length ? contributions.map((c) => `
        <div class="list-row" style="min-height:52px">
          ${avatarHTML({ name: c.name, avatar: c.avatar, accent: "transparent" }, 30)}
          <div class="main">
            <div class="name" style="font-size:var(--fs-14)">${esc(c.name)} added ${money(c.amount)}</div>
            <div class="meta">${c.note ? "“" + esc(c.note) + "” · " : ""}${relTime(c.at)}</div>
          </div>
        </div>`).join("") : `
        <div class="list-row"><div class="main t-secondary t-small">No contributions yet — be the first.</div></div>`}
    </div>
  </div>`;

  view.querySelector("#gd-back").addEventListener("click", () => navigate("/groups"));
  view.querySelector("#gd-invite").addEventListener("click", () => openShareSheet(group.code, group.name));
  view.querySelector("#gd-add").addEventListener("click", () => openContribute(state, reload));
  view.querySelector("#gd-menu").addEventListener("click", () => openGroupMenu(state, isOwner, reload));
  view.querySelectorAll("[data-gach]").forEach((b) =>
    b.addEventListener("click", () => {
      const a = groupAchievementById(b.dataset.gach);
      const when = state.achievements[a.id];
      if (when) showAchievement({ ...a, points: 0 });
      else openSheet(`<h2 class="sheet-title">🔒 ${esc(a.title)}</h2><p class="t-secondary">${esc(a.desc)}</p>`);
    }));
}

function memberRow(m, index, group, myId) {
  const per = Number(group.per_person);
  const p = per ? Math.min(100, Math.round((m.saved / per) * 100)) : 0;
  const isMe = m.userId === myId;
  const rank = index + 1;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `<span class="rank-num">${rank}</span>`;
  const flair = flairStyle(m.equipped);
  const fx = effectClass(m.equipped);
  const lvl = levelFor(m.lifetimePoints);
  return `
  <div class="card member-row ${isMe ? "me" : ""}" data-member="${m.userId}" style="--accent:${esc(m.accent)}">
    <div class="row">
      <div class="rank">${medal}</div>
      ${flair ? `<span class="flair-ring" style="${flair}">${avatarHTML(m, 35)}</span>` : avatarHTML(m, 40)}
      <div class="grow" style="min-width:0">
        <div class="row" style="gap:6px">
          <span class="member-name ${fx}">${esc(m.name)}</span>${isMe ? '<span class="you-tag">you</span>' : ""}
          ${tagHTML(m.equipped)}
          <span class="level-chip">Lv ${lvl.level}</span>
          ${m.statusEmoji || m.statusText ? `<span class="member-status">${esc(m.statusEmoji)} ${esc(m.statusText)}</span>` : ""}
        </div>
        <div class="member-bar"><i style="width:${p}%"></i></div>
      </div>
      <div class="end">
        <div class="amount t-num">${money(m.saved)}</div>
        <div class="meta t-num">${p}%</div>
      </div>
    </div>
  </div>`;
}

/* ---------- FLIP rank animation ---------- */

function capturePositions(view) {
  const map = {};
  view.querySelectorAll("[data-member]").forEach((el) => {
    map[el.dataset.member] = el.getBoundingClientRect().top;
  });
  return map;
}

function playFLIP(view, prev) {
  view.querySelectorAll("[data-member]").forEach((el) => {
    const before = prev[el.dataset.member];
    if (before == null) return;
    const delta = before - el.getBoundingClientRect().top;
    if (Math.abs(delta) < 2) return;
    el.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
      { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  });
}

/* ---------- contribute ---------- */

function openContribute(state, reload) {
  const { group } = state;
  const per = Number(group.per_person);
  const me = state.members.find((m) => m.userId === currentUser().id);
  const remainingMine = Math.max(0, per - (me?.saved || 0));
  const suggest = [10, 25, 50, 100].filter((v) => v <= Math.max(10, remainingMine || per));

  openSheet(`
    <h2 class="sheet-title">${group.icon} Add savings</h2>
    <div class="chip-row" style="margin-bottom:14px">
      ${suggest.map((v) => `<button class="chip" data-v="${v}">${money(v)}</button>`).join("")}
    </div>
    <form id="gc-form">
      <div class="amount-input-wrap">
        <span class="currency">$</span>
        <input class="input" id="gc-amount" inputmode="decimal" placeholder="0.00" required>
      </div>
      <input class="input" id="gc-note" placeholder="Note for the group (optional)" maxlength="100" style="margin-top:10px">
      ${get().profile.onboarded ? `
      <label class="row" style="min-height:44px;cursor:pointer;margin-top:6px">
        <input type="checkbox" id="gc-local" checked style="width:20px;height:20px;accent-color:var(--green-600)">
        <span style="font-size:var(--fs-14)">Also log in my personal budget</span>
      </label>` : ""}
      <button class="btn btn-primary btn-block" style="margin-top:10px" id="gc-submit">Add to the pot</button>
    </form>
    ${remainingMine > 0 ? `<p class="t-small t-secondary" style="margin-top:12px">${money(remainingMine)} left to hit your personal target.</p>` : `<p class="t-small t-pos" style="margin-top:12px">You've hit your personal target — everything extra pads the group.</p>`}
  `, {
    onOpen(sheet, close) {
      const amountEl = sheet.querySelector("#gc-amount");
      sheet.querySelectorAll(".chip").forEach((c) =>
        c.addEventListener("click", () => { amountEl.value = c.dataset.v; amountEl.focus(); }));
      sheet.querySelector("#gc-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const amount = parseFloat(amountEl.value.replace(/[^0-9.]/g, ""));
        if (isNaN(amount) || amount <= 0) return;
        const note = sheet.querySelector("#gc-note").value.trim();
        const logLocal = sheet.querySelector("#gc-local")?.checked;
        const btn = sheet.querySelector("#gc-submit");
        btn.disabled = true;
        btn.textContent = "Adding…";
        try {
          await api.addContribution(group.id, amount, note);
          if (logLocal) {
            update((s) => {
              s.transactions.unshift({ id: uid(), categoryId: "savings", amount, note: "→ " + group.name, date: todayISO() });
              s.settings.savingsBuffer = (s.settings.savingsBuffer || 0) + amount;
            });
          }
          close();
          awardContribution(amount);
          reload({ animate: true });
        } catch (err) {
          toast(api.friendlyCloudError(err, "Couldn't add that"));
          btn.disabled = false;
          btn.textContent = "Add to the pot";
        }
      });
    },
  });
}

/* ---------- menu (accent, edit, leave/delete) ---------- */

function openGroupMenu(state, isOwner, reload) {
  const { group } = state;
  const myAccent = state.members.find((m) => m.userId === currentUser().id)?.accent || "#3E7A4D";
  openSheet(`
    <h2 class="sheet-title">Group options</h2>
    <div class="field"><label class="field-label">Your color in this group</label>
      ${accentPickerHTML(myAccent, { name: "gm" })}</div>
    <div class="stack" style="margin-top:16px">
      ${isOwner ? `<button class="btn btn-secondary btn-block" id="gm-edit">Edit group details</button>` : ""}
      ${isOwner
        ? `<button class="btn btn-danger-ghost btn-block" id="gm-delete">Delete group</button>`
        : `<button class="btn btn-danger-ghost btn-block" id="gm-leave">Leave group</button>`}
    </div>
  `, {
    onOpen(sheet, close) {
      bindAccentPicker(sheet, "gm", async (hex) => {
        try {
          await api.setMyGroupAccent(group.id, hex);
          toast("Color updated");
          reload();
        } catch { toast("Couldn't update color"); }
      });
      sheet.querySelector("#gm-edit")?.addEventListener("click", () => { close(); openEditGroup(state, reload); });
      sheet.querySelector("#gm-delete")?.addEventListener("click", async () => {
        close();
        if (await confirmSheet({ title: "Delete " + group.name + "?", body: "This removes the group and its history for every member. There is no undo.", confirmLabel: "Delete for everyone", danger: true })) {
          try { await api.deleteGroup(group.id); toast("Group deleted"); navigate("/groups"); }
          catch (e) { toast(e.message || "Couldn't delete"); }
        }
      });
      sheet.querySelector("#gm-leave")?.addEventListener("click", async () => {
        close();
        if (await confirmSheet({ title: "Leave " + group.name + "?", body: "Your contributions history stays with the group, but you'll no longer see it.", confirmLabel: "Leave group", danger: true })) {
          try { await api.leaveGroup(group.id); toast("You left the group"); navigate("/groups"); }
          catch (e) { toast(e.message || "Couldn't leave"); }
        }
      });
    },
  });
}

function openEditGroup(state, reload) {
  const { group } = state;
  openSheet(`
    <h2 class="sheet-title">Edit group</h2>
    <form id="ge-form" class="stack">
      <div class="field"><label class="field-label" for="ge-name">Name</label>
        <input class="input" id="ge-name" value="${esc(group.name)}" maxlength="48" required></div>
      <div class="field"><label class="field-label" for="ge-desc">Description</label>
        <textarea class="input" id="ge-desc" rows="2" maxlength="300">${esc(group.description || "")}</textarea></div>
      <div class="row">
        <div class="field grow"><label class="field-label" for="ge-amount">Each person saves</label>
          <div class="amount-input-wrap"><span class="currency">$</span>
          <input class="input" id="ge-amount" inputmode="decimal" value="${Number(group.per_person)}" required></div></div>
        <div class="field grow"><label class="field-label" for="ge-date">Target date</label>
          <input class="input" id="ge-date" type="date" value="${group.target_date || ""}"></div>
      </div>
      <button class="btn btn-primary btn-block">Save changes</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#ge-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = sheet.querySelector("#ge-name").value.trim();
        const description = sheet.querySelector("#ge-desc").value.trim();
        const per = parseFloat(sheet.querySelector("#ge-amount").value.replace(/[^0-9.]/g, ""));
        const target_date = sheet.querySelector("#ge-date").value || null;
        if (!name || isNaN(per) || per <= 0) return;
        try {
          await api.updateGroup(group.id, { name, description, per_person: per, target_date });
          close(); toast("Group updated"); reload();
        } catch (err) { toast(err.message || "Couldn't save"); }
      });
    },
  });
}

/* ---------- group achievement detection ---------- */

/** Returns true if any achievement was newly added to state.achievements this call. */
async function detectUnlocks(state) {
  let changed = false;
  for (const a of GROUP_ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.check(state); } catch { ok = false; }
    if (!ok) continue;
    try {
      const won = await api.unlockGroupAchievement(state.group.id, a.id);
      state.achievements[a.id] = new Date().toISOString();
      changed = true;
      if (won && !shownUnlocks.has(state.group.id + a.id)) {
        shownUnlocks.add(state.group.id + a.id);
        showAchievement({ ...a, points: 0 });
      }
    } catch { /* ignore */ }
  }
  return changed;
}

/** Realtime-delivered unlocks from other members also deserve a celebration. */
function markSeen(achievements) {
  for (const id of Object.keys(achievements)) {
    const key = "seen-" + id;
    if (shownUnlocks.has(key)) continue;
    shownUnlocks.add(key);
  }
}

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d ago";
  return shortDate(iso.slice(0, 10));
}
