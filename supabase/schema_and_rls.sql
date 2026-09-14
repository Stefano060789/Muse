create table if not exists profiles (
  id uuid references auth.users on delete cascade,
  display_name text,
  timezone text,
  preferred_voices text[],
  favorites jsonb,
  cycle_opt_in boolean default false,
  created_at timestamptz default now(),
  primary key (id)
);

create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  message_date date not null,
  voice text,
  prompt_hash text,
  content text,
  liked boolean,
  created_at timestamptz default now()
);

create index if not exists idx_messages_user_date on messages (user_id, message_date);

alter table if exists profiles enable row level security;
alter table if exists messages enable row level security;

create policy if not exists "profiles_insert_own" on profiles
  for insert
  with check ( auth.uid() = id );

create policy if not exists "profiles_select_update_own" on profiles
  for select, update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

create policy if not exists "messages_insert_own" on messages
  for insert
  with check ( auth.uid() = user_id );

create policy if not exists "messages_select_own" on messages
  for select
  using ( auth.uid() = user_id );

create policy if not exists "messages_update_liked_own" on messages
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );
