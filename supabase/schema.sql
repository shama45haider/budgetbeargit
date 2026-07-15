-- Budget Bear — cloud schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: statements use IF NOT EXISTS / OR REPLACE where possible.

-- pgcrypto powers gen_random_bytes() used by the invite-code generator below.
-- Supabase projects always have an "extensions" schema; installing there
-- (rather than public) is the platform convention.
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'New Bear',
  avatar_url text,
  banner_color text not null default '#3E7A4D',
  accent_color text not null default '#3E7A4D',
  about text not null default '',
  pronouns text not null default '',
  status_emoji text not null default '',
  status_text text not null default '',
  updated_at timestamptz not null default now(),
  constraint display_name_len check (char_length(display_name) between 1 and 32),
  constraint about_len check (char_length(about) <= 200),
  constraint status_len check (char_length(status_text) <= 60),
  constraint pronouns_len check (char_length(pronouns) <= 24)
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'New Bear'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- GROUPS
-- ============================================================

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text not null default '🎯',
  description text not null default '',
  target_date date,
  per_person numeric(12,2) not null check (per_person > 0),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint name_len check (char_length(name) between 1 and 48),
  constraint description_len check (char_length(description) <= 300)
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  accent_color text not null default '#3E7A4D',
  saved numeric(12,2) not null default 0,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount <= 1000000),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint note_len check (char_length(note) <= 100)
);
create index if not exists contributions_group_idx on public.contributions (group_id, created_at desc);

-- Migration: earlier versions of this schema pointed user_id at auth.users,
-- which PostgREST can't traverse for embedding (`profiles:user_id(...)`)
-- since auth.users isn't exposed to it. Repoint at public.profiles instead —
-- safe because every user gets a profiles row via the signup trigger below,
-- and profiles.id already references auth.users(id) 1:1.
do $$ begin
  alter table public.group_members drop constraint if exists group_members_user_id_fkey;
  alter table public.group_members
    add constraint group_members_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
exception when others then null; end $$;

do $$ begin
  alter table public.contributions drop constraint if exists contributions_user_id_fkey;
  alter table public.contributions
    add constraint contributions_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
exception when others then null; end $$;

create table if not exists public.group_achievements (
  group_id uuid not null references public.groups (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (group_id, achievement_id)
);

-- Membership check that avoids recursive RLS lookups
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.contributions enable row level security;
alter table public.group_achievements enable row level security;

-- groups
drop policy if exists "members read their groups" on public.groups;
create policy "members read their groups"
  on public.groups for select to authenticated using (public.is_group_member(id));

drop policy if exists "users create groups" on public.groups;
create policy "users create groups"
  on public.groups for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "owner updates group" on public.groups;
create policy "owner updates group"
  on public.groups for update to authenticated using (auth.uid() = created_by);

drop policy if exists "owner deletes group" on public.groups;
create policy "owner deletes group"
  on public.groups for delete to authenticated using (auth.uid() = created_by);

-- group_members
drop policy if exists "members read member rows" on public.group_members;
create policy "members read member rows"
  on public.group_members for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "members update own row" on public.group_members;
create policy "members update own row"
  on public.group_members for update to authenticated using (auth.uid() = user_id);

drop policy if exists "members leave" on public.group_members;
create policy "members leave"
  on public.group_members for delete to authenticated using (auth.uid() = user_id);
-- inserts happen only via create_group/join_group (security definer)

-- contributions
drop policy if exists "members read contributions" on public.contributions;
create policy "members read contributions"
  on public.contributions for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "members add own contributions" on public.contributions;
create policy "members add own contributions"
  on public.contributions for insert to authenticated
  with check (auth.uid() = user_id and public.is_group_member(group_id));

-- group_achievements
drop policy if exists "members read group achievements" on public.group_achievements;
create policy "members read group achievements"
  on public.group_achievements for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "members record group achievements" on public.group_achievements;
create policy "members record group achievements"
  on public.group_achievements for insert to authenticated
  with check (public.is_group_member(group_id));

-- ============================================================
-- TRIGGER: abuse guard — a script looping addContribution() could otherwise
-- flood the table; this simply rejects inserts faster than 1/second per user.
-- ============================================================

create or replace function public.guard_contribution_rate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from contributions
    where user_id = new.user_id
      and created_at > now() - interval '1 second'
  ) then
    raise exception 'too_fast';
  end if;
  return new;
end $$;

drop trigger if exists on_contribution_rate_guard on public.contributions;
create trigger on_contribution_rate_guard
  before insert on public.contributions
  for each row execute function public.guard_contribution_rate();

-- ============================================================
-- TRIGGER: keep group_members.saved = sum of contributions
-- ============================================================

create or replace function public.apply_contribution()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update group_members
     set saved = saved + new.amount
   where group_id = new.group_id and user_id = new.user_id;
  return new;
end $$;

drop trigger if exists on_contribution_added on public.contributions;
create trigger on_contribution_added
  after insert on public.contributions
  for each row execute function public.apply_contribution();

-- ============================================================
-- RPC: create_group (returns the new group id + code)
-- ============================================================

create or replace function public.create_group(
  p_name text, p_icon text, p_description text,
  p_target_date date, p_per_person numeric, p_accent text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  -- Abuse guard: stop a script from flooding the database with junk groups.
  if (select count(*) from groups where created_by = auth.uid()) >= 30 then
    raise exception 'group_limit_reached';
  end if;

  -- 8-char unambiguous code
  loop
    v_code := upper(substr(replace(replace(encode(extensions.gen_random_bytes(8), 'base64'), '/', ''), '+', ''), 1, 8));
    exit when not exists (select 1 from groups where code = v_code);
  end loop;

  insert into groups (code, name, icon, description, target_date, per_person, created_by)
  values (v_code, p_name, p_icon, coalesce(p_description, ''), p_target_date, p_per_person, auth.uid())
  returning id into v_id;

  insert into group_members (group_id, user_id, role, accent_color)
  values (v_id, auth.uid(), 'owner', coalesce(p_accent, '#3E7A4D'));

  return json_build_object('id', v_id, 'code', v_code);
end $$;

-- ============================================================
-- RPC: join_group by invite code
-- ============================================================

create or replace function public.join_group(p_code text, p_accent text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_group groups%rowtype;
  v_count int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_group from groups where code = upper(trim(p_code));
  if not found then return json_build_object('error', 'invalid_code'); end if;

  select count(*) into v_count from group_members where group_id = v_group.id;
  if v_count >= 20 then return json_build_object('error', 'group_full'); end if;

  insert into group_members (group_id, user_id, accent_color)
  values (v_group.id, auth.uid(), coalesce(p_accent, '#3E7A4D'))
  on conflict (group_id, user_id) do nothing;

  return json_build_object('id', v_group.id, 'name', v_group.name, 'icon', v_group.icon);
end $$;

-- ============================================================
-- RPC: preview_group (name/icon/members shown on the join screen, no membership needed)
-- ============================================================

create or replace function public.preview_group(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_group groups%rowtype;
  v_count int;
begin
  select * into v_group from groups where code = upper(trim(p_code));
  if not found then return json_build_object('error', 'invalid_code'); end if;
  select count(*) into v_count from group_members where group_id = v_group.id;
  return json_build_object(
    'name', v_group.name, 'icon', v_group.icon, 'description', v_group.description,
    'target_date', v_group.target_date, 'per_person', v_group.per_person, 'members', v_count
  );
end $$;

-- ============================================================
-- GRANTS
-- RLS policies only filter rows; Postgres also requires the base table
-- privilege before a policy is ever evaluated. Without these grants every
-- query returns "permission denied for table …" regardless of RLS.
-- ============================================================

grant usage on schema public to authenticated, anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, update, delete on public.group_members to authenticated;
grant select, insert on public.contributions to authenticated;
grant select, insert on public.group_achievements to authenticated;

-- The join/create/preview RPCs are SECURITY DEFINER (run as their owner),
-- but callers still need EXECUTE granted to actually invoke them.
grant execute on function public.create_group(text, text, text, date, numeric, text) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.preview_group(text) to authenticated, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

do $$ begin
  alter publication supabase_realtime add table public.group_members;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.contributions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.group_achievements;
exception when duplicate_object then null; end $$;

-- ============================================================
-- STORAGE: avatars bucket (public read, users write to their own folder)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- V3: POINTS + SHOP
-- Bear Points live server-side so the shop can't be cheated and
-- cosmetics (flairs, tags, name effects) are visible to friends.
-- ============================================================

alter table public.profiles add column if not exists points int not null default 0;
alter table public.profiles add column if not exists lifetime_points int not null default 0;
alter table public.profiles add column if not exists equipped jsonb not null default '{}';

-- Item ids + prices only; the visuals live in the client catalog (js/data/shop.js).
create table if not exists public.shop_items (
  id text primary key,
  price int not null check (price > 0)
);

insert into public.shop_items (id, price) values
  ('flair-mint', 150), ('flair-sunset', 250), ('flair-ocean', 250),
  ('flair-night', 300), ('flair-lava', 400), ('flair-rainbow', 500),
  ('flair-aurora', 550), ('flair-gold', 600),
  ('tag-penny', 100), ('tag-coupon', 150), ('tag-machine', 200),
  ('tag-stacking', 200), ('tag-bse', 250), ('tag-slayer', 300),
  ('tag-millionaire', 350), ('tag-ceo', 400),
  ('fx-shimmer', 300), ('fx-wave', 450), ('fx-gold', 500),
  ('fx-rainbow', 600), ('fx-sparkle', 700), ('fx-frost', 900),
  ('theme-midnight', 800), ('theme-sakura', 800),
  ('theme-ocean', 800), ('theme-royal', 1500)
on conflict (id) do update set price = excluded.price;

create table if not exists public.user_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.shop_items (id),
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.shop_items enable row level security;
alter table public.user_items enable row level security;

drop policy if exists "shop items are readable" on public.shop_items;
create policy "shop items are readable"
  on public.shop_items for select to authenticated using (true);

drop policy if exists "users read own items" on public.user_items;
create policy "users read own items"
  on public.user_items for select to authenticated using (auth.uid() = user_id);
-- purchases happen only through buy_item (security definer)

-- Earn points, with abuse caps: 1–300 per call, max one call per 3 seconds.
create or replace function public.earn_points(p_amount int, p_reason text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_points int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_amount < 1 or p_amount > 300 then raise exception 'bad_amount'; end if;

  select updated_at into v_last from profiles where id = auth.uid();
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'too_fast';
  end if;

  update profiles
     set points = points + p_amount,
         lifetime_points = lifetime_points + p_amount,
         updated_at = now()
   where id = auth.uid()
   returning points into v_points;

  return json_build_object('points', v_points);
end $$;

-- Buy a shop item: price comes from shop_items, never from the client.
create or replace function public.buy_item(p_item_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_points int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select price into v_price from shop_items where id = p_item_id;
  if not found then return json_build_object('error', 'no_such_item'); end if;

  if exists (select 1 from user_items where user_id = auth.uid() and item_id = p_item_id) then
    return json_build_object('error', 'already_owned');
  end if;

  select points into v_points from profiles where id = auth.uid() for update;
  if v_points < v_price then
    return json_build_object('error', 'not_enough_points', 'points', v_points, 'price', v_price);
  end if;

  update profiles set points = points - v_price where id = auth.uid();
  insert into user_items (user_id, item_id) values (auth.uid(), p_item_id);

  return json_build_object('points', v_points - v_price);
end $$;

-- Equip an owned item into a slot (flair | tag | effect | theme), or null to unequip.
create or replace function public.equip_item(p_slot text, p_item_id text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_slot not in ('flair', 'tag', 'effect', 'theme') then raise exception 'bad_slot'; end if;

  if p_item_id is not null and not exists (
    select 1 from user_items where user_id = auth.uid() and item_id = p_item_id
  ) then
    return json_build_object('error', 'not_owned');
  end if;

  update profiles
     set equipped = case
       when p_item_id is null then equipped - p_slot
       else jsonb_set(equipped, array[p_slot], to_jsonb(p_item_id))
     end
   where id = auth.uid();

  return json_build_object('ok', true);
end $$;

grant select on public.shop_items to authenticated;
grant select on public.user_items to authenticated;
grant execute on function public.earn_points(int, text) to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.equip_item(text, text) to authenticated;

-- ============================================================
-- Force PostgREST to reload its schema cache immediately, so new
-- foreign keys (and other relationship changes) are visible to the API
-- right away rather than waiting for its own periodic refresh.
-- ============================================================
notify pgrst, 'reload schema';
