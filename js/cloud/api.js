/* Budget Bear — cloud data API: groups, members, contributions, group achievements. */

import { getClient, currentUser } from "./client.js";

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
    .select("user_id, saved, accent_color, role, joined_at, profiles:user_id(display_name, avatar_url, status_emoji, status_text, accent_color)")
    .eq("group_id", groupId);
  if (error) throw error;
  return (data || []).map((m) => ({
    userId: m.user_id,
    saved: Number(m.saved),
    accent: m.accent_color || m.profiles?.accent_color || "#3E7A4D",
    role: m.role,
    joinedAt: m.joined_at,
    name: m.profiles?.display_name || "Member",
    avatar: m.profiles?.avatar_url || null,
    statusEmoji: m.profiles?.status_emoji || "",
    statusText: m.profiles?.status_text || "",
  })).sort((a, b) => b.saved - a.saved || a.joinedAt.localeCompare(b.joinedAt));
}

export async function setMyGroupAccent(groupId, accent) {
  const c = getClient();
  const { error } = await c.from("group_members")
    .update({ accent_color: accent })
    .eq("group_id", groupId).eq("user_id", currentUser().id);
  if (error) throw error;
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
