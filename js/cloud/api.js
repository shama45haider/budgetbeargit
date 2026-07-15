/* Budget Bear — cloud data API: groups, members, contributions, group achievements. */

import { getClient, currentUser } from "./client.js";

/** Turn a raised Postgres exception (or network error) into user-facing text. */
export function friendlyCloudError(err, fallback = "Something went wrong. Try again.") {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("group_limit_reached")) return "You've hit the limit of 30 groups. Delete an old one to create another.";
  if (m.includes("too_fast")) return "That was fast — wait a second and try again.";
  if (m.includes("group_full")) return "That group is full (20 members max).";
  if (m.includes("permission denied")) return "You don't have access to do that.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your connection.";
  return err?.message || fallback;
}

/* ---------- Groups ---------- */

export async function myGroups() {
  const c = getClient();
  const { data, error } = await c
    .from("group_members")
    .select("group_id, saved, accent_color, role, groups(*)")
    .eq("user_id", currentUser().id)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return (data || []).filter((r) => r.groups).map((r) => ({
    ...r.groups,
    mySaved: Number(r.saved),
    myAccent: r.accent_color,
    myRole: r.role,
  }));
}

export async function createGroup({ name, icon, description, targetDate, perPerson, accent }) {
  const c = getClient();
  const { data, error } = await c.rpc("create_group", {
    p_name: name, p_icon: icon, p_description: description,
    p_target_date: targetDate, p_per_person: perPerson, p_accent: accent,
  });
  if (error) throw error;
  return data; // { id, code }
}

export async function previewGroup(code) {
  const c = getClient();
  const { data, error } = await c.rpc("preview_group", { p_code: code });
  if (error) throw error;
  return data;
}

export async function joinGroup(code, accent) {
  const c = getClient();
  const { data, error } = await c.rpc("join_group", { p_code: code, p_accent: accent });
  if (error) throw error;
  return data; // { id, name, icon } or { error }
}

export async function getGroup(id) {
  const c = getClient();
  const { data, error } = await c.from("groups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateGroup(id, fields) {
  const c = getClient();
  const { error } = await c.from("groups").update(fields).eq("id", id);
  if (error) throw error;
}

export async function leaveGroup(id) {
  const c = getClient();
  const { error } = await c.from("group_members")
    .delete().eq("group_id", id).eq("user_id", currentUser().id);
  if (error) throw error;
}

export async function deleteGroup(id) {
  const c = getClient();
  const { error } = await c.from("groups").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Members & profiles ---------- */

export async function groupMembers(groupId) {
  const c = getClient();
  const { data, error } = await c
    .from("group_members")
    .select("user_id, saved, accent_color, role, joined_at, custom_target, profiles:user_id(display_name, avatar_url, status_emoji, status_text, accent_color, equipped, lifetime_points)")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data || []).map((m) => ({
    userId: m.user_id,
    saved: Number(m.saved),
    accent: m.accent_color || m.profiles?.accent_color || "#3E7A4D",
    role: m.role,
    joinedAt: m.joined_at,
    customTarget: m.custom_target != null ? Number(m.custom_target) : null,
    name: m.profiles?.display_name || "Member",
    avatar: m.profiles?.avatar_url || null,
    statusEmoji: m.profiles?.status_emoji || "",
    statusText: m.profiles?.status_text || "",
    equipped: m.profiles?.equipped || {},
    lifetimePoints: m.profiles?.lifetime_points || 0,
  })).sort((a, b) => b.saved - a.saved || a.joinedAt.localeCompare(b.joinedAt));
}

export async function setMyGroupAccent(groupId, accent) {
  const c = getClient();
  const { error } = await c.from("group_members")
    .update({ accent_color: accent })
    .eq("group_id", groupId).eq("user_id", currentUser().id);
  if (error) throw error;
}

/** Owner-only: assign (or clear, with target=null) a member's custom savings target. */
export async function setMemberTarget(groupId, memberUserId, target) {
  const c = getClient();
  const { data, error } = await c.rpc("set_member_target", {
    p_group_id: groupId, p_member_id: memberUserId, p_target: target,
  });
  if (error) throw error;
  return data; // { ok: true } or { error }
}

/* ---------- Contributions ---------- */

export async function addContribution(groupId, amount, note = "") {
  const c = getClient();
  const { error } = await c.from("contributions")
    .insert({ group_id: groupId, user_id: currentUser().id, amount, note });
  if (error) throw error;
}

export async function recentContributions(groupId, limit = 15) {
  const c = getClient();
  const { data, error } = await c
    .from("contributions")
    .select("id, user_id, amount, note, created_at, profiles:user_id(display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((x) => ({
    id: x.id,
    userId: x.user_id,
    amount: Number(x.amount),
    note: x.note,
    at: x.created_at,
    name: x.profiles?.display_name || "Member",
    avatar: x.profiles?.avatar_url || null,
  }));
}

/* ---------- Group achievements ---------- */

export async function groupAchievements(groupId) {
  const c = getClient();
  const { data, error } = await c.from("group_achievements")
    .select("achievement_id, unlocked_at").eq("group_id", groupId);
  if (error) throw error;
  const map = {};
  for (const r of data || []) map[r.achievement_id] = r.unlocked_at;
  return map;
}

/** Insert if new. Returns true when THIS call unlocked it (dupe-safe across clients). */
export async function unlockGroupAchievement(groupId, achievementId) {
  const c = getClient();
  const { error } = await c.from("group_achievements")
    .insert({ group_id: groupId, achievement_id: achievementId });
  if (error) {
    if (error.code === "23505") return false; // already unlocked by someone
    throw error;
  }
  return true;
}

/* ---------- Realtime ---------- */

/** Subscribe to live changes for one group. Returns an unsubscribe fn. */
export function subscribeGroup(groupId, onChange) {
  const c = getClient();
  const channel = c.channel("group-" + groupId)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "group_members", filter: "group_id=eq." + groupId },
      onChange)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "contributions", filter: "group_id=eq." + groupId },
      onChange)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "group_achievements", filter: "group_id=eq." + groupId },
      onChange)
    .subscribe();
  return () => c.removeChannel(channel);
}

/* ---------- Points & Shop ---------- */

/** Server-side point award (capped + rate-limited in the RPC). Returns new balance. */
export async function earnPoints(amount, reason) {
  const c = getClient();
  const { data, error } = await c.rpc("earn_points", { p_amount: amount, p_reason: reason });
  if (error) throw error;
  return data.points;
}

/** Buy a shop item; price and balance are checked server-side. */
export async function buyItem(itemId) {
  const c = getClient();
  const { data, error } = await c.rpc("buy_item", { p_item_id: itemId });
  if (error) throw error;
  return data; // { points } or { error, ... }
}

/** Equip an owned item into a slot ('flair'|'tag'|'effect'); null unequips. */
export async function equipItem(slot, itemId) {
  const c = getClient();
  const { data, error } = await c.rpc("equip_item", { p_slot: slot, p_item_id: itemId });
  if (error) throw error;
  return data;
}

/** Item ids the current user owns. */
export async function myItems() {
  const c = getClient();
  const { data, error } = await c.from("user_items")
    .select("item_id").eq("user_id", currentUser().id);
  if (error) throw error;
  return (data || []).map((r) => r.item_id);
}

/** One spin per UTC day; the server picks the prize. Returns {prize, points, balance} or {error}. */
export async function dailySpin() {
  const c = getClient();
  const { data, error } = await c.rpc("daily_spin");
  if (error) throw error;
  return data;
}

/** Redeem a supporter code for the thank-you bundle. */
export async function redeemCode(code) {
  const c = getClient();
  const { data, error } = await c.rpc("redeem_code", { p_code: code });
  if (error) throw error;
  return data;
}

/* ---------- Group Chat ---------- */

export async function sendGroupMessage(groupId, body) {
  const c = getClient();
  const { data, error } = await c.rpc("send_group_message", { p_group_id: groupId, p_body: body });
  if (error) throw error;
  return data; // { ok: true, id, created_at } or { error }
}

export async function recentMessages(groupId, limit = 50) {
  const c = getClient();
  const { data, error } = await c
    .from("group_messages")
    .select("id, user_id, body, created_at, profiles:user_id(display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    body: m.body,
    at: m.created_at,
    name: m.profiles?.display_name || "Member",
    avatar: m.profiles?.avatar_url || null,
  }));
}

/** Live chat for one group — a channel of its own so a new message never
    triggers a full leaderboard/achievement reload (see subscribeGroup). */
export function subscribeGroupChat(groupId, onInsert) {
  const c = getClient();
  const channel = c.channel("group-chat-" + groupId)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages", filter: "group_id=eq." + groupId },
      onInsert)
    .subscribe();
  return () => c.removeChannel(channel);
}
