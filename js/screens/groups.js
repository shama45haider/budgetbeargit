/* Budget Bear — Groups tab: your group links, create, and join flows. */

import { esc, money, shortDate } from "../format.js";
import { currentUser, myProfile } from "../cloud/client.js";
import { cloudConfigured } from "../cloud/config.js";
import * as api from "../cloud/api.js";
import { openSheet, toast } from "../ui/components.js";
import { GOAL_TEMPLATES } from "../data/categories.js";
import { accentPickerHTML, bindAccentPicker } from "../data/accents.js";
import { navigate, refresh } from "../router.js";
import { authNext } from "./auth.js";

export function renderGroups(view) {
  if (!currentUser()) {
    renderSignedOut(view);
    return;
  }

  view.innerHTML = `
  <div class="screen">
    <header class="screen-header">
      <h1>Groups</h1>
      <span class="sub">Save together</span>
    </header>
    <div id="groups-list">
      ${skeletonCards(2)}
    </div>
    <div class="stack" style="margin-top:12px">
      <button class="btn btn-primary btn-block" id="btn-create-group">Create a Group Link</button>
      <button class="btn btn-secondary btn-block" id="btn-join-code">Join with a code</button>
    </div>
  </div>`;

  view.querySelector("#btn-create-group").addEventListener("click", openCreateGroup);
  view.querySelector("#btn-join-code").addEventListener("click", openJoinByCode);

  loadGroups(view);
}

function renderSignedOut(view) {
  view.innerHTML = `
  <div class="screen">
    <header class="screen-header"><h1>Groups</h1></header>
    <div class="empty-state" style="padding-top:40px">
      <img src="assets/bears/excitedbear.png" alt="">
      <h3>Save toward goals — together</h3>
      <p>Create a Group Link, invite your friends, and race to a shared goal on a live leaderboard.</p>
    </div>
    <div class="stack">
      <div class="card" style="padding:14px 16px"><div class="row">
        <div class="icon-bubble">🔗</div>
        <div class="grow"><h3 style="font-size:var(--fs-15)">One link invites everyone</h3>
        <div class="t-small t-secondary">No usernames to type — share the link, friends jump in.</div></div>
      </div></div>
      <div class="card" style="padding:14px 16px"><div class="row">
        <div class="icon-bubble">🏆</div>
        <div class="grow"><h3 style="font-size:var(--fs-15)">Live ranking</h3>
        <div class="t-small t-secondary">Everyone's progress bar, in their own color. Most saved rises to the top.</div></div>
      </div></div>
      <div class="card" style="padding:14px 16px"><div class="row">
        <div class="icon-bubble">🎖️</div>
        <div class="grow"><h3 style="font-size:var(--fs-15)">Group achievements</h3>
        <div class="t-small t-secondary">Milestones you can only unlock as a team.</div></div>
      </div></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px" id="btn-auth">
      ${cloudConfigured() ? "Sign in or create an account" : "See setup requirements"}
    </button>
  </div>`;
  view.querySelector("#btn-auth").addEventListener("click", () => {
    authNext("/groups");
    navigate("/auth");
  });
}

async function loadGroups(view) {
  const list = view.querySelector("#groups-list");
  try {
    const groups = await api.myGroups();
    if (!view.isConnected) return;
    if (!groups.length) {
      list.innerHTML = `
        <div class="empty-state">
          <img src="assets/bears/pointbear.png" alt="">
          <h3>No groups yet</h3>
          <p>Create a Group Link and send it to your friends — or paste a code someone sent you.</p>
        </div>`;
      return;
    }
    // fetch members for avatar stacks + totals (parallel)
    const withMembers = await Promise.all(groups.map(async (g) => ({
      ...g, members: await api.groupMembers(g.id),
    })));
    if (!view.isConnected) return;
    list.innerHTML = withMembers.map(groupCard).join("");
    list.querySelectorAll("[data-group]").forEach((el) =>
      el.addEventListener("click", () => navigate("/group/" + el.dataset.group)));
  } catch (e) {
    list.innerHTML = `<div class="callout danger"><span>⚠️</span><div>Couldn't load your groups. ${esc(e.message || "")}</div></div>`;
  }
}

function groupCard(g) {
  const total = g.members.reduce((a, m) => a + m.saved, 0);
  const target = Number(g.per_person) * Math.max(1, g.members.length);
  const p = target ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const avatars = g.members.slice(0, 5).map((m, i) => avatarHTML(m, 30, `margin-left:${i ? -9 : 0}px;z-index:${9 - i}`)).join("");
  return `
  <button class="card tappable group-card" data-group="${g.id}" style="width:100%;text-align:left;margin-bottom:12px">
    <div class="row" style="margin-bottom:10px">
      <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px;font-size:20px">${g.icon}</div>
      <div class="grow">
        <h3>${esc(g.name)}</h3>
        <div class="t-small t-secondary">${g.target_date ? "By " + shortDate(g.target_date) + " · " : ""}${money(Number(g.per_person))} each</div>
      </div>
      <div class="avatar-stack">${avatars}${g.members.length > 5 ? `<span class="avatar-more">+${g.members.length - 5}</span>` : ""}</div>
    </div>
    <div class="row" style="align-items:baseline;margin-bottom:6px">
      <strong class="t-num">${money(total)}</strong>
      <span class="t-small t-secondary grow">of ${money(target)}</span>
      <span class="t-small t-num">${p}%</span>
    </div>
    <div class="progress"><i style="width:${p}%"></i></div>
  </button>`;
}

export function avatarHTML(m, size = 34, extraStyle = "") {
  const ring = `border:2px solid ${esc(m.accent || "#3E7A4D")};`;
  if (m.avatar) {
    return `<img class="avatar" src="${esc(m.avatar)}" alt="" width="${size}" height="${size}"
      style="width:${size}px;height:${size}px;${ring}${extraStyle}" loading="lazy">`;
  }
  const initial = (m.name || "?").trim().charAt(0).toUpperCase();
  return `<span class="avatar avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.44)}px;${ring}${extraStyle}">${esc(initial)}</span>`;
}

/* ---------- Create group ---------- */

function openCreateGroup() {
  const me = myProfile();
  openSheet(`
    <h2 class="sheet-title">Create a Group Link</h2>
    <div class="cat-grid" style="grid-template-columns:repeat(3,1fr)">
      ${GOAL_TEMPLATES.filter((t) => t.id !== "custom").slice(0, 6).map((t) => `
        <button type="button" class="cat-tile" data-tpl="${t.id}"><span>${t.icon}</span><small>${esc(t.name)}</small></button>`).join("")}
    </div>
    <form id="cg-form" class="stack" style="margin-top:14px">
      <div class="field"><label class="field-label" for="cg-name">Group name</label>
        <input class="input" id="cg-name" placeholder="Florida trip" maxlength="48" required></div>
      <div class="field"><label class="field-label" for="cg-desc">Description (optional)</label>
        <textarea class="input" id="cg-desc" rows="2" maxlength="300" placeholder="Spring break — flights, hotel, and fun money"></textarea></div>
      <div class="row">
        <div class="field grow"><label class="field-label" for="cg-amount">Each person saves</label>
          <div class="amount-input-wrap"><span class="currency">$</span>
          <input class="input" id="cg-amount" inputmode="decimal" placeholder="800" required></div></div>
        <div class="field grow"><label class="field-label" for="cg-date">Target date</label>
          <input class="input" id="cg-date" type="date"></div>
      </div>
      <div class="field"><label class="field-label">Your color</label>
        ${accentPickerHTML(me?.accent_color || "#3E7A4D", { name: "cg" })}</div>
      <button class="btn btn-primary btn-block" id="cg-submit">Create group</button>
    </form>
  `, {
    onOpen(sheet, close) {
      let icon = "🎯";
      let accent = me?.accent_color || "#3E7A4D";
      sheet.querySelectorAll(".cat-tile").forEach((b) =>
        b.addEventListener("click", () => {
          sheet.querySelectorAll(".cat-tile").forEach((x) => x.classList.remove("selected"));
          b.classList.add("selected");
          const tpl = GOAL_TEMPLATES.find((t) => t.id === b.dataset.tpl);
          icon = tpl.icon;
          const nameEl = sheet.querySelector("#cg-name");
          if (!nameEl.value) nameEl.value = tpl.name;
        }));
      bindAccentPicker(sheet, "cg", (hex) => { accent = hex; });

      sheet.querySelector("#cg-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = sheet.querySelector("#cg-submit");
        const name = sheet.querySelector("#cg-name").value.trim();
        const description = sheet.querySelector("#cg-desc").value.trim();
        const perPerson = parseFloat(sheet.querySelector("#cg-amount").value.replace(/[^0-9.]/g, ""));
        const targetDate = sheet.querySelector("#cg-date").value || null;
        if (!name || isNaN(perPerson) || perPerson <= 0) return;
        btn.disabled = true;
        btn.textContent = "Creating…";
        try {
          const res = await api.createGroup({ name, icon, description, targetDate, perPerson, accent });
          close();
          navigate("/group/" + res.id);
          setTimeout(() => openShareSheet(res.code, name), 450);
        } catch (err) {
          toast(api.friendlyCloudError(err, "Couldn't create the group"));
          btn.disabled = false;
          btn.textContent = "Create group";
        }
      });
    },
  });
}

export function inviteURL(code) {
  const base = location.origin + location.pathname;
  return `${base}#/join/${code}`;
}

export function openShareSheet(code, groupName) {
  const url = inviteURL(code);
  openSheet(`
    <h2 class="sheet-title">Invite your friends</h2>
    <p class="t-secondary t-small" style="margin-bottom:14px">Anyone with this link can join <strong>${esc(groupName)}</strong>.</p>
    <div class="invite-box">
      <div class="invite-url t-num">${esc(url)}</div>
    </div>
    <div class="stack" style="margin-top:14px">
      <button class="btn btn-primary btn-block" id="share-copy">Copy link</button>
      ${navigator.share ? `<button class="btn btn-secondary btn-block" id="share-native">Share…</button>` : ""}
      <div class="t-small t-secondary" style="text-align:center">or share the code: <strong class="t-num">${esc(code)}</strong></div>
    </div>
  `, {
    onOpen(sheet) {
      sheet.querySelector("#share-copy").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast("Link copied");
        } catch {
          toast("Couldn't copy — long-press the link to copy it");
        }
      });
      sheet.querySelector("#share-native")?.addEventListener("click", () => {
        navigator.share({ title: "Join my Budget Bear group", text: `Save with me toward "${groupName}" on Budget Bear`, url }).catch(() => {});
      });
    },
  });
}

/* ---------- Join ---------- */

function openJoinByCode() {
  openSheet(`
    <h2 class="sheet-title">Join a group</h2>
    <form id="jc-form">
      <input class="input" id="jc-code" placeholder="Paste a code, e.g. 7KQ2XW9A" maxlength="12"
        style="text-transform:uppercase;font-variant-numeric:tabular-nums" autocomplete="off" required>
      <button class="btn btn-primary btn-block" style="margin-top:12px">Continue</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#jc-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const code = sheet.querySelector("#jc-code").value.trim().toUpperCase();
        if (!code) return;
        close();
        navigate("/join/" + code);
      });
    },
  });
}

/** The #/join/CODE landing screen. */
export function renderJoin(view, code) {
  if (!currentUser()) {
    authNext("/join/" + code);
    navigate("/auth");
    return;
  }
  const me = myProfile();

  view.innerHTML = `
  <div class="screen">
    <header class="screen-header"><h1>Join group</h1></header>
    <div id="join-body">${skeletonCards(1)}</div>
  </div>`;

  api.previewGroup(code).then((g) => {
    const body = view.querySelector("#join-body");
    if (!body) return;
    if (g.error) {
      body.innerHTML = `
        <div class="empty-state">
          <img src="assets/bears/confusedbear.png" alt="">
          <h3>That link isn't valid</h3>
          <p>The group may have been deleted, or the code was mistyped.</p>
        </div>
        <button class="btn btn-secondary btn-block" onclick="location.hash='/groups'">Back to Groups</button>`;
      return;
    }
    let accent = me?.accent_color || "#3E7A4D";
    body.innerHTML = `
      <div class="card" style="text-align:center;padding:24px">
        <div style="font-size:44px;margin-bottom:8px">${g.icon}</div>
        <h2>${esc(g.name)}</h2>
        ${g.description ? `<p class="t-secondary t-small" style="margin-top:6px">${esc(g.description)}</p>` : ""}
        <div class="join-facts">
          <div><small>Each saves</small><strong class="t-num">${money(Number(g.per_person))}</strong></div>
          <div><small>Members</small><strong>${g.members}/20</strong></div>
          ${g.target_date ? `<div><small>Target</small><strong>${shortDate(g.target_date)}</strong></div>` : ""}
        </div>
      </div>
      <div class="field" style="margin-top:16px"><label class="field-label">Pick your color</label>
        ${accentPickerHTML(accent, { name: "join" })}</div>
      <button class="btn btn-primary btn-block" id="btn-join" style="margin-top:14px">Join ${esc(g.name)}</button>
      <button class="btn btn-ghost btn-block" onclick="location.hash='/groups'">Not now</button>`;
    bindAccentPicker(body, "join", (hex) => { accent = hex; });
    body.querySelector("#btn-join").addEventListener("click", async () => {
      const btn = body.querySelector("#btn-join");
      btn.disabled = true;
      btn.textContent = "Joining…";
      try {
        const res = await api.joinGroup(code, accent);
        if (res.error === "group_full") { toast("That group is full (20 max)"); btn.disabled = false; return; }
        if (res.error) { toast("That link isn't valid"); btn.disabled = false; return; }
        toast("Welcome to " + res.name);
        navigate("/group/" + res.id);
      } catch (err) {
        toast(err.message || "Couldn't join");
        btn.disabled = false;
        btn.textContent = "Join";
      }
    });
  }).catch(() => {
    const body = view.querySelector("#join-body");
    if (body) body.innerHTML = `<div class="callout danger"><span>⚠️</span><div>Couldn't reach the server. Check your connection and try again.</div></div>`;
  });
}

function skeletonCards(n) {
  return Array.from({ length: n }, () =>
    `<div class="skeleton" style="height:132px;margin-bottom:12px"></div>`).join("");
}
