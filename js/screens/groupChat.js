/* Budget Bear — Group Chat: talk with everyone in the group. */

import { esc, shortDate } from "../format.js";
import { currentUser } from "../cloud/client.js";
import * as api from "../cloud/api.js";
import { toast } from "../ui/components.js";
import { navigate } from "../router.js";
import { avatarHTML } from "./groups.js";
import { authNext } from "./auth.js";

let unsubscribe = null;

export function renderGroupChat(view, groupId) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  if (!currentUser()) {
    authNext("/group/" + groupId + "/chat");
    navigate("/auth");
    return;
  }

  view.innerHTML = `
  <div class="screen coach-screen">
    <header class="screen-header">
      <div class="row" style="gap:8px">
        <button class="wizard-back" id="gc-back" aria-label="Back to group">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <h1 id="gc-title">Chat</h1>
      </div>
    </header>
    <div class="coach-chat" id="gc-messages" aria-live="polite">
      <div class="skeleton" style="height:44px;margin-bottom:8px;border-radius:16px"></div>
      <div class="skeleton" style="height:44px;width:70%;margin-bottom:8px;border-radius:16px"></div>
    </div>
    <form class="coach-inputbar" id="gc-form">
      <input class="input" id="gc-input" placeholder="Say something to the group…" autocomplete="off" maxlength="500">
      <button class="btn btn-primary" aria-label="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </form>
  </div>`;

  view.querySelector("#gc-back").addEventListener("click", () => navigate("/group/" + groupId));

  const me = currentUser();
  const list = view.querySelector("#gc-messages");

  const load = async () => {
    try {
      const [group, messages] = await Promise.all([
        api.getGroup(groupId),
        api.recentMessages(groupId),
      ]);
      if (!view.isConnected) return;
      if (!group) {
        view.innerHTML = `<div class="screen"><div class="empty-state" style="padding-top:60px">
          <img src="assets/bears/confusedbear.png" alt="">
          <h3>Group not found</h3></div>
          <button class="btn btn-secondary btn-block" onclick="location.hash='/groups'">Back to Groups</button></div>`;
        return;
      }
      view.querySelector("#gc-title").textContent = group.icon + " " + group.name;
      paintMessages(list, messages, me.id);
    } catch (e) {
      if (!view.isConnected) return;
      list.innerHTML = `<div class="callout danger"><span>⚠️</span><div>Couldn't load the chat. ${esc(e.message || "Check your connection.")}</div></div>`;
    }
  };

  load();

  // Own channel: a new message never touches the leaderboard/achievement flow.
  unsubscribe = api.subscribeGroupChat(groupId, (payload) => {
    appendLiveMessage(list, payload.new, me.id);
  });

  view.querySelector("#gc-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = view.querySelector("#gc-input");
    const body = input.value.trim();
    if (!body) return;
    input.value = "";
    input.disabled = true;
    try {
      const res = await api.sendGroupMessage(groupId, body);
      if (res?.error === "too_fast") {
        toast("Sending a bit fast — give it a second");
      } else if (res?.error) {
        toast("Couldn't send that");
      }
      // Own message arrives back via the realtime subscription — no manual append needed.
    } catch (err) {
      toast(api.friendlyCloudError(err, "Couldn't send that"));
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}

function paintMessages(list, messages, myId) {
  if (!messages.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding-top:40px">
        <img src="assets/bears/happybear.png" alt="">
        <h3>No messages yet</h3>
        <p>Say hi — plan the trip, split who's bringing what, hype each other up.</p>
      </div>`;
    return;
  }
  list.innerHTML = messages.map((m) => bubbleHTML(m, myId)).join("");
  list.scrollTop = list.scrollHeight;
}

function bubbleHTML(m, myId) {
  const mine = m.userId === myId;
  return `
  <div class="ob-bubble ${mine ? "me" : ""}" data-msg="${m.id}">
    ${mine ? "" : avatarHTML({ name: m.name, avatar: m.avatar, accent: "transparent" }, 28)}
    <div>
      ${mine ? "" : `<div class="chat-sender">${esc(m.name)}</div>`}
      <div class="ob-msg">${esc(m.body)}</div>
      <div class="chat-time ${mine ? "chat-time-mine" : ""}">${relTime(m.at)}</div>
    </div>
  </div>`;
}

function appendLiveMessage(list, row, myId) {
  // Fetch-free append: the realtime payload has everything except the sender's
  // profile, which we only need for other people's messages (name/avatar).
  if (row.user_id === myId) {
    const empty = list.querySelector(".empty-state");
    if (empty) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", bubbleHTML({
      id: row.id, userId: row.user_id, body: row.body, at: row.created_at, name: "", avatar: null,
    }, myId));
    list.scrollTop = list.scrollHeight;
    return;
  }
  // For others, just re-fetch the small recent list — simplest way to get their
  // current display name/avatar without a second realtime join query.
  api.recentMessages(row.group_id).then((messages) => {
    if (!list.isConnected) return;
    paintMessages(list, messages, myId);
  }).catch(() => {});
}

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return shortDate(iso.slice(0, 10));
}
