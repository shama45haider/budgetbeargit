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
  -- high-end animated flairs
  ('flair-prism', 850), ('flair-molten', 1000), ('flair-galaxy', 1200),
  ('tag-penny', 100), ('tag-coupon', 150), ('tag-machine', 200),
  ('tag-stacking', 200), ('tag-bse', 250), ('tag-slayer', 300),
  ('tag-millionaire', 350), ('tag-ceo', 400),
  -- high-end tags (premium treatments)
  ('tag-legend', 550), ('tag-diamond', 700), ('tag-goat', 900),
  ('fx-shimmer', 300), ('fx-wave', 450), ('fx-gold', 500),
  ('fx-rainbow', 600), ('fx-sparkle', 700), ('fx-frost', 900),
  -- high-end name effects
  ('fx-plasma', 1100), ('fx-ember', 1300), ('fx-prismatic', 1600),
  ('theme-midnight', 800), ('theme-sakura', 800),
  ('theme-ocean', 800), ('theme-royal', 1500),
  ('theme-amethyst', 800), ('theme-moneyrain', 1200), ('theme-crimson', 800),
  -- high-end themes with signature ambient effects
  ('theme-obsidian', 1800), ('theme-emerald', 2000), ('theme-aurora', 2500),
  -- price 999999 = not for sale: won on the Daily Spin or granted to supporters
  ('flair-lucky', 999999), ('tag-jackpot', 999999),
  ('flair-crown', 999999), ('tag-supporter', 999999)
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
  if v_price >= 999999 then return json_build_object('error', 'not_for_sale'); end if;

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
-- V4: DAILY SPIN + SUPPORTER CODES + PLANS
-- ============================================================

alter table public.profiles add column if not exists last_spin_at timestamptz;
alter table public.profiles add column if not exists plan text not null default 'free';

-- One spin per UTC day; the server picks the prize so it can't be gamed.
create or replace function public.daily_spin()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_roll numeric;
  v_prize text;
  v_points int := 0;
  v_balance int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select last_spin_at into v_last from profiles where id = auth.uid() for update;
  if v_last is not null
     and (v_last at time zone 'utc')::date = (now() at time zone 'utc')::date then
    return json_build_object('error', 'already_spun');
  end if;

  v_roll := random();
  if    v_roll < 0.30  then v_prize := 'points'; v_points := 25;
  elsif v_roll < 0.55  then v_prize := 'points'; v_points := 50;
  elsif v_roll < 0.72  then v_prize := 'points'; v_points := 75;
  elsif v_roll < 0.84  then v_prize := 'points'; v_points := 100;
  elsif v_roll < 0.92  then v_prize := 'points'; v_points := 150;
  elsif v_roll < 0.96  then v_prize := 'points'; v_points := 300;
  elsif v_roll < 0.985 then v_prize := 'flair-lucky';
  else                      v_prize := 'tag-jackpot';
  end if;

  if v_prize <> 'points' then
    if exists (select 1 from user_items where user_id = auth.uid() and item_id = v_prize) then
      v_prize := 'points'; v_points := 100; -- already won it — consolation points
    else
      insert into user_items (user_id, item_id) values (auth.uid(), v_prize);
    end if;
  end if;

  update profiles
     set last_spin_at = now(),
         points = points + v_points,
         lifetime_points = lifetime_points + v_points
   where id = auth.uid()
   returning points into v_balance;

  return json_build_object('prize', v_prize, 'points', v_points, 'balance', v_balance);
end $$;

-- Supporter codes: the owner mints them, donors redeem for the thank-you bundle.
-- Mint one:  insert into redeem_codes (code, max_uses) values ('BEAR-THANKYOU-1', 1);
create table if not exists public.redeem_codes (
  code text primary key,
  bundle text not null default 'supporter',
  max_uses int not null default 1,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.code_redemptions (
  code text not null references public.redeem_codes (code) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

-- Locked tables: no policies on purpose — only the definer RPC touches them.
alter table public.redeem_codes enable row level security;
alter table public.code_redemptions enable row level security;

create or replace function public.redeem_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_row redeem_codes%rowtype;
  v_balance int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_row from redeem_codes where code = upper(trim(p_code)) for update;
  if not found then return json_build_object('error', 'invalid_code'); end if;
  if v_row.used_count >= v_row.max_uses then return json_build_object('error', 'code_used_up'); end if;
  if exists (select 1 from code_redemptions where code = v_row.code and user_id = auth.uid()) then
    return json_build_object('error', 'already_redeemed');
  end if;

  insert into code_redemptions (code, user_id) values (v_row.code, auth.uid());
  update redeem_codes set used_count = used_count + 1 where code = v_row.code;

  -- Supporter thank-you bundle: Aurora Crown flair + Early Supporter tag + 200 points
  insert into user_items (user_id, item_id)
    values (auth.uid(), 'flair-crown'), (auth.uid(), 'tag-supporter')
    on conflict do nothing;

  update profiles
     set points = points + 200,
         lifetime_points = lifetime_points + 200
   where id = auth.uid()
   returning points into v_balance;

  return json_build_object('ok', true, 'points', 200, 'balance', v_balance);
end $$;

grant execute on function public.daily_spin() to authenticated;
grant execute on function public.redeem_code(text) to authenticated;

-- ============================================================
-- V5: AI COACH USAGE LIMIT
-- The AI Coach edge function calls this before asking Groq, so the daily
-- cap is enforced server-side (a client can't just skip the check).
-- ============================================================

alter table public.profiles add column if not exists ai_msg_count int not null default 0;
alter table public.profiles add column if not exists ai_msg_date date;
alter table public.profiles add column if not exists ai_last_msg_at timestamptz;

create or replace function public.use_ai_message(p_daily_limit int default 20)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_count int;
  v_date date;
  v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select ai_msg_count, ai_msg_date, ai_last_msg_at into v_count, v_date, v_last
    from profiles where id = auth.uid() for update;

  -- Abuse guard: a signed-in bot could otherwise burn the whole daily quota
  -- in a fraction of a second. Mirrors guard_contribution_rate's pattern.
  if v_last is not null and v_last > now() - interval '2 seconds' then
    return json_build_object('error', 'too_fast');
  end if;

  if v_date is distinct from v_today then
    v_count := 0;
  end if;

  if v_count >= p_daily_limit then
    return json_build_object('error', 'quota_exceeded', 'limit', p_daily_limit);
  end if;

  update profiles
     set ai_msg_count = v_count + 1, ai_msg_date = v_today, ai_last_msg_at = now()
   where id = auth.uid();

  return json_build_object('ok', true, 'remaining', p_daily_limit - (v_count + 1));
end $$;

grant execute on function public.use_ai_message(int) to authenticated;

-- ============================================================
-- V6: GROUP CHAT + OWNER-ASSIGNED PER-MEMBER GOALS
-- ============================================================

-- ---------- Group chat ----------

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint body_len check (char_length(body) between 1 and 500)
);
create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at desc);

alter table public.group_messages enable row level security;

drop policy if exists "members read group messages" on public.group_messages;
create policy "members read group messages"
  on public.group_messages for select to authenticated using (public.is_group_member(group_id));
-- inserts happen only via send_group_message (security definer)

create or replace function public.send_group_message(p_group_id uuid, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_body text := trim(p_body);
  v_row group_messages%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'not_a_member'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    return json_build_object('error', 'bad_length');
  end if;

  select created_at into v_last from group_messages
    where group_id = p_group_id and user_id = auth.uid()
    order by created_at desc limit 1;
  if v_last is not null and v_last > now() - interval '1.5 seconds' then
    return json_build_object('error', 'too_fast');
  end if;

  insert into group_messages (group_id, user_id, body)
    values (p_group_id, auth.uid(), v_body)
    returning * into v_row;

  return json_build_object('ok', true, 'id', v_row.id, 'created_at', v_row.created_at);
end $$;

grant select on public.group_messages to authenticated;
grant execute on function public.send_group_message(uuid, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null; end $$;

-- ---------- Owner-assigned per-member goals ----------

alter table public.group_members add column if not exists custom_target numeric(12,2);

create or replace function public.set_member_target(p_group_id uuid, p_member_id uuid, p_target numeric)
returns json language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from groups where id = p_group_id and created_by = auth.uid()) then
    return json_build_object('error', 'not_owner');
  end if;
  if p_target is not null and p_target <= 0 then
    return json_build_object('error', 'bad_target');
  end if;

  update group_members set custom_target = p_target
   where group_id = p_group_id and user_id = p_member_id;

  if not found then return json_build_object('error', 'not_a_member'); end if;
  return json_build_object('ok', true);
end $$;

grant execute on function public.set_member_target(uuid, uuid, numeric) to authenticated;

-- ============================================================
-- V7: ACCOUNT DELETION
-- ============================================================
-- Clients can't touch auth.users directly; this definer function (owned by
-- postgres, which has delete rights on the auth schema) lets a signed-in user
-- delete exactly their own account. Every app table hangs off auth.users or
-- profiles with ON DELETE CASCADE, so one delete wipes profile, memberships,
-- contributions, messages, items, and owned groups. Storage objects don't
-- cascade from auth.users, so the avatar files are cleared explicitly first.

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from storage.objects
   where bucket_id = 'avatars' and name like auth.uid()::text || '/%';
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================
-- V8: SECURITY HARDENING
-- ============================================================
-- Root cause this block fixes: RLS answers "which ROWS may I touch?" It says
-- nothing about WHICH COLUMNS. The grants above were table-wide, so the
-- "users update own profile" policy happily allowed
--   update profiles set points = 9e9, plan = 'premium', ai_msg_count = 0
-- from the browser console. Every definer RPC below (earn_points, buy_item,
-- daily_spin, use_ai_message) was decorative — the client could just skip it.
-- The fix is column-level GRANTs: the client may write only the cosmetic
-- fields it actually owns; everything else moves behind a definer RPC.

-- ---------- 8.1 profiles: column-level write access ----------

-- updated_at leaves the client's hands (it was also earn_points' rate-limit
-- clock, so a forged value defeated the throttle). A trigger owns it now.
create or replace function public.touch_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists on_profile_update on public.profiles;
create trigger on_profile_update
  before update on public.profiles
  for each row execute function public.touch_profile();

revoke update on public.profiles from authenticated;
grant update (display_name, banner_color, accent_color,
              about, pronouns, status_emoji, status_text) on public.profiles to authenticated;

-- Deliberately NOT granted: avatar_url (set_avatar_url), points, lifetime_points,
-- equipped, plan, plan_expires_at, last_spin_at, spin_date, spins_today,
-- ai_msg_count, ai_msg_date, ai_last_msg_at, updated_at, and the earn_points
-- bookkeeping columns. All of those are written only by definer RPCs.

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Colour fields land inside style="..." attributes. esc() blocks attribute
-- breakout but is not a CSS sanitiser (';' and '(' survive), so a forged
-- value could inject background:url(...) into every group member's view.
-- Validate at the boundary that actually holds.
do $$ begin
  alter table public.profiles add constraint accent_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint banner_hex check (banner_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

-- avatar_url was an unconstrained text column, i.e. an arbitrary URL rendered
-- into <img src> for every group member (an IP/timing beacon at minimum).
-- Only our own Storage bucket is acceptable.
create or replace function public.set_avatar_url(p_url text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_url is not null and p_url not like
     'https://wxnajrkonkcilfilvoyw.supabase.co/storage/v1/object/public/avatars/' || auth.uid()::text || '/%'
  then
    return json_build_object('error', 'bad_url');
  end if;
  update profiles set avatar_url = p_url where id = auth.uid();
  return json_build_object('ok', true);
end $$;

grant execute on function public.set_avatar_url(text) to authenticated;

-- Reading every profile's points/plan/quota counters is broader than the app
-- needs: it only ever shows people you share a group with.
--
-- SECURITY DEFINER for the same reason is_group_member is (see above): a policy
-- on profiles that reads group_members would otherwise re-enter group_members'
-- own policy. The definer boundary stops the recursion.
create or replace function public.shares_group_with(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

grant execute on function public.shares_group_with(uuid) to authenticated;

drop policy if exists "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.shares_group_with(id));

-- ---------- 8.2 group_members: column-level write access ----------

-- Without `with check`, Postgres reuses `using (auth.uid() = user_id)` — a
-- predicate satisfied regardless of group_id. A member could repoint their own
-- row at ANY group uuid (they appear in shareable #/group/<id> URLs), and
-- is_group_member() would then hand them that group's chat, contributions and
-- member profiles with no invite code. `saved` was writable too, which made the
-- contribution trigger, the rate guard and the amount ceiling all pointless.
revoke update on public.group_members from authenticated;
grant update (accent_color) on public.group_members to authenticated;

drop policy if exists "members update own row" on public.group_members;
create policy "members update own row"
  on public.group_members for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin
  alter table public.group_members add constraint gm_accent_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

-- ---------- 8.3 groups.icon: stored XSS ----------

-- icon had no constraint and is rendered raw into innerHTML on the group card,
-- the group detail header and — worst — the public join screen, which paints
-- BEFORE the victim joins. `p_icon: '<img src=x onerror=...>'` via the RPC plus
-- an invite link exfiltrated the Supabase session (access + refresh token) from
-- localStorage: full account takeover of everyone who opened the link. The
-- client escapes it now too; this is the half that a console call can't skip.
do $$ begin
  alter table public.groups add constraint icon_len check (char_length(icon) between 1 and 8);
exception when duplicate_object then null; end $$;

-- ---------- 8.4 earn_points: the amount came from the client ----------

-- Old shape: earn_points(p_amount int, ...) with 1..300 allowed and a 3s
-- throttle — a setInterval yielded ~8.6M points/day, so the shop economy was
-- decorative. The server now decides the amount.
--
-- Honest limitation: check-ins, achievements and goal contributions all happen
-- against on-device state, so the server cannot independently confirm one
-- occurred. Two classes of reason, treated differently:
--   * verified   (daily_checkin, achievement) — amount and idempotency are
--                 entirely server-owned, so these cannot be farmed at all.
--   * declared   (goal_contribution, migration) — unverifiable, so the amount
--                 is clamped and a daily ceiling bounds a forged claim to about
--                 what an honest heavy user earns in a day.

alter table public.profiles add column if not exists last_earn_at timestamptz;
alter table public.profiles add column if not exists checkin_date date;
alter table public.profiles add column if not exists checkin_streak int not null default 0;
alter table public.profiles add column if not exists best_streak int not null default 0;
alter table public.profiles add column if not exists earn_date date;
alter table public.profiles add column if not exists earned_today int not null default 0;
alter table public.profiles add column if not exists migrated boolean not null default false;

-- Mirrors the points in js/data/achievements.js. The client proposes an id;
-- the server decides what it's worth and whether it was already paid out.
create table if not exists public.achievement_points (
  id text primary key,
  points int not null check (points >= 0)
);
insert into public.achievement_points (id, points) values
  ('first-plan', 50), ('first-goal', 40), ('first-100', 60), ('first-1000', 150),
  ('goal-complete', 200), ('streak-3', 30), ('streak-7', 80), ('streak-30', 300),
  ('under-budget-month', 120), ('tracker-10', 30), ('points-500', 0)
on conflict (id) do update set points = excluded.points;

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievement_points (id),
  awarded_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.user_achievements enable row level security;

drop policy if exists "users read own achievement awards" on public.user_achievements;
create policy "users read own achievement awards"
  on public.user_achievements for select to authenticated using (auth.uid() = user_id);
-- writes happen only inside earn_points (security definer)

alter table public.achievement_points enable row level security;
drop policy if exists "achievement points are readable" on public.achievement_points;
create policy "achievement points are readable"
  on public.achievement_points for select to authenticated using (true);

drop function if exists public.earn_points(int, text);

create or replace function public.earn_points(
  p_reason text, p_ref text default null, p_amount int default null
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_declared_cap constant int := 500;   -- per UTC day, unverifiable reasons only
  v_award int := 0;
  v_rows int;
  v_last timestamptz;
  v_earn_date date;
  v_earned_today int;
  v_checkin date;
  v_streak int;
  v_best int;
  v_migrated boolean;
  v_points int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select last_earn_at, earn_date, earned_today, checkin_date, checkin_streak, best_streak, migrated
    into v_last, v_earn_date, v_earned_today, v_checkin, v_streak, v_best, v_migrated
    from profiles where id = auth.uid() for update;

  if v_last is not null and v_last > now() - interval '1 second' then
    return json_build_object('error', 'too_fast');
  end if;

  if v_earn_date is distinct from v_today then v_earned_today := 0; end if;

  if p_reason = 'daily_checkin' then
    if v_checkin = v_today then return json_build_object('error', 'already_checked_in'); end if;
    -- The streak is server-owned now; it used to live in localStorage, where it
    -- was both forgeable and the trigger for the +75 bonus.
    v_streak := case when v_checkin = v_today - 1 then coalesce(v_streak, 0) + 1 else 1 end;
    v_best := greatest(coalesce(v_best, 0), v_streak);
    v_award := 25;
    if v_streak % 7 = 0 then v_award := v_award + 75; end if;
    update profiles
       set checkin_date = v_today, checkin_streak = v_streak, best_streak = v_best
     where id = auth.uid();

  elsif p_reason = 'achievement' then
    select points into v_award from achievement_points where id = p_ref;
    if not found then return json_build_object('error', 'no_such_achievement'); end if;
    insert into user_achievements (user_id, achievement_id)
      values (auth.uid(), p_ref) on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then return json_build_object('error', 'already_awarded'); end if;

  elsif p_reason = 'goal_contribution' then
    v_award := least(greatest(coalesce(p_amount, 0), 1), 100);
    v_award := least(v_award, greatest(0, v_declared_cap - v_earned_today));
    if v_award = 0 then return json_build_object('error', 'daily_cap'); end if;
    update profiles set earn_date = v_today, earned_today = v_earned_today + v_award
     where id = auth.uid();

  elsif p_reason = 'migration' then
    if v_migrated then return json_build_object('error', 'already_migrated'); end if;
    v_award := least(greatest(coalesce(p_amount, 0), 0), 2000);
    update profiles set migrated = true where id = auth.uid();

  else
    return json_build_object('error', 'bad_reason');
  end if;

  update profiles
     set points = points + v_award,
         lifetime_points = lifetime_points + v_award,
         last_earn_at = now()
   where id = auth.uid()
   returning points into v_points;

  return json_build_object(
    'ok', true, 'awarded', v_award, 'points', v_points,
    'streak', coalesce(v_streak, 0), 'best_streak', coalesce(v_best, 0)
  );
end $$;

grant execute on function public.earn_points(text, text, int) to authenticated;
grant select on public.achievement_points to authenticated;
grant select on public.user_achievements to authenticated;

-- ============================================================
-- V9: PREMIUM
-- ============================================================
-- Every gate here is decided by is_premium() INSIDE a definer RPC, so it holds
-- even though the client can see (but not write) its own plan. plan and
-- plan_expires_at are written only by redeem_code (and, later, a Stripe
-- webhook) — they are absent from the V8 column grants.

alter table public.profiles add column if not exists plan_expires_at timestamptz;
do $$ begin
  alter table public.profiles add constraint plan_valid check (plan in ('free','premium','business'));
exception when duplicate_object then null; end $$;

-- One boolean the whole schema shares. security definer so a storage policy or
-- another RPC can call it regardless of the caller's row visibility. A null
-- expiry means "no expiry" (e.g. a comped/business account).
create or replace function public.is_premium()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and plan in ('premium','business')
      and (plan_expires_at is null or plan_expires_at > now())
  );
$$;

grant execute on function public.is_premium() to authenticated;

-- ---------- 9.1 AI quota: 5 free / 100 premium ----------
-- The edge function still passes p_daily_limit, but the RPC no longer trusts
-- it — the limit is derived from is_premium() here, server-side.
create or replace function public.use_ai_message(p_daily_limit int default 20)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_limit int := case when public.is_premium() then 100 else 5 end;
  v_count int;
  v_date date;
  v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select ai_msg_count, ai_msg_date, ai_last_msg_at into v_count, v_date, v_last
    from profiles where id = auth.uid() for update;

  if v_last is not null and v_last > now() - interval '2 seconds' then
    return json_build_object('error', 'too_fast');
  end if;

  if v_date is distinct from v_today then v_count := 0; end if;

  if v_count >= v_limit then
    return json_build_object('error', 'quota_exceeded', 'limit', v_limit);
  end if;

  update profiles
     set ai_msg_count = v_count + 1, ai_msg_date = v_today, ai_last_msg_at = now()
   where id = auth.uid();

  return json_build_object('ok', true, 'remaining', v_limit - (v_count + 1), 'limit', v_limit);
end $$;

-- ---------- 9.2 Group creation: 2 free / 30 premium ----------
create or replace function public.create_group(
  p_name text, p_icon text, p_description text,
  p_target_date date, p_per_person numeric, p_accent text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
  v_cap int := case when public.is_premium() then 30 else 2 end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  if (select count(*) from groups where created_by = auth.uid()) >= v_cap then
    -- Distinct code so the client can show an upsell rather than a dead end.
    return json_build_object('error',
      case when v_cap = 30 then 'group_limit_reached' else 'group_limit_free' end);
  end if;

  -- Guard: an emoji is all the icon should ever be (also an XSS constraint, V8).
  if p_icon is null or char_length(p_icon) > 8 then
    return json_build_object('error', 'bad_icon');
  end if;

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

-- ---------- 9.3 Daily spin: 1 free / 2 premium ----------
alter table public.profiles add column if not exists spin_date date;
alter table public.profiles add column if not exists spins_today int not null default 0;

create or replace function public.daily_spin()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_allowed int := case when public.is_premium() then 2 else 1 end;
  v_date date;
  v_used int;
  v_roll numeric;
  v_prize text;
  v_points int := 0;
  v_balance int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select spin_date, spins_today into v_date, v_used from profiles where id = auth.uid() for update;
  if v_date is distinct from v_today then v_used := 0; end if;
  if v_used >= v_allowed then
    return json_build_object('error', 'already_spun', 'allowed', v_allowed);
  end if;

  v_roll := random();
  if    v_roll < 0.30  then v_prize := 'points'; v_points := 25;
  elsif v_roll < 0.55  then v_prize := 'points'; v_points := 50;
  elsif v_roll < 0.72  then v_prize := 'points'; v_points := 75;
  elsif v_roll < 0.84  then v_prize := 'points'; v_points := 100;
  elsif v_roll < 0.92  then v_prize := 'points'; v_points := 150;
  elsif v_roll < 0.96  then v_prize := 'points'; v_points := 300;
  elsif v_roll < 0.985 then v_prize := 'flair-lucky';
  else                      v_prize := 'tag-jackpot';
  end if;

  if v_prize <> 'points' then
    if exists (select 1 from user_items where user_id = auth.uid() and item_id = v_prize) then
      v_prize := 'points'; v_points := 100;
    else
      insert into user_items (user_id, item_id) values (auth.uid(), v_prize);
    end if;
  end if;

  update profiles
     set spin_date = v_today,
         spins_today = v_used + 1,
         last_spin_at = now(),
         points = points + v_points,
         lifetime_points = lifetime_points + v_points
   where id = auth.uid()
   returning points into v_balance;

  return json_build_object(
    'prize', v_prize, 'points', v_points, 'balance', v_balance,
    'remaining', v_allowed - (v_used + 1)
  );
end $$;

-- ---------- 9.4 Grant premium via redeem code ----------
-- The bundle column has existed (defaulted to 'supporter') since V4 but was
-- never read. 'premium1m' grants a month, stacking from the later of now / the
-- current expiry so two codes give two months.
create or replace function public.redeem_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_row redeem_codes%rowtype;
  v_balance int;
  v_expires timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into v_row from redeem_codes where code = upper(trim(p_code)) for update;
  if not found then return json_build_object('error', 'invalid_code'); end if;
  if v_row.used_count >= v_row.max_uses then return json_build_object('error', 'code_used_up'); end if;
  if exists (select 1 from code_redemptions where code = v_row.code and user_id = auth.uid()) then
    return json_build_object('error', 'already_redeemed');
  end if;

  insert into code_redemptions (code, user_id) values (v_row.code, auth.uid());
  update redeem_codes set used_count = used_count + 1 where code = v_row.code;

  if v_row.bundle = 'premium1m' then
    update profiles
       set plan = 'premium',
           plan_expires_at = greatest(now(), coalesce(plan_expires_at, now())) + interval '1 month'
     where id = auth.uid()
     returning plan_expires_at into v_expires;
    return json_build_object('ok', true, 'bundle', 'premium1m', 'expires', v_expires);
  end if;

  -- Default 'supporter' bundle: Aurora Crown flair + Early Supporter tag + 200 points
  insert into user_items (user_id, item_id)
    values (auth.uid(), 'flair-crown'), (auth.uid(), 'tag-supporter')
    on conflict do nothing;

  update profiles
     set points = points + 200,
         lifetime_points = lifetime_points + 200
   where id = auth.uid()
   returning points into v_balance;

  return json_build_object('ok', true, 'bundle', 'supporter', 'points', 200, 'balance', v_balance);
end $$;

-- ---------- 9.5 Custom category images (Premium) ----------
-- Mirrors the avatars bucket, with one added clause: only premium accounts may
-- write. This is the sole SERVER-enforced part of the custom-category feature —
-- the category list itself lives in localStorage, so its gate is client-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('category-images', 'category-images', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists "category images are publicly readable" on storage.objects;
create policy "category images are publicly readable"
  on storage.objects for select using (bucket_id = 'category-images');

drop policy if exists "premium users upload category images" on storage.objects;
create policy "premium users upload category images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'category-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_premium()
  );

drop policy if exists "premium users update category images" on storage.objects;
create policy "premium users update category images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'category-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_premium()
  );

-- Removing a category image is allowed regardless of plan — a lapsed user must
-- still be able to clean up (and delete_account must purge without a plan check).
drop policy if exists "users delete own category images" on storage.objects;
create policy "users delete own category images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'category-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- delete_account gains the new bucket. Storage doesn't cascade from auth.users,
-- so every bucket a user writes to must be purged here by hand.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from storage.objects
   where bucket_id in ('avatars', 'category-images')
     and name like auth.uid()::text || '/%';
  delete from auth.users where id = auth.uid();
end $$;

-- ============================================================
-- Force PostgREST to reload its schema cache immediately, so new
-- foreign keys (and other relationship changes) are visible to the API
-- right away rather than waiting for its own periodic refresh.
-- ============================================================
notify pgrst, 'reload schema';
