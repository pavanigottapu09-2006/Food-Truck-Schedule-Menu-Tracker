-- Food Truck Tracker schema (Supabase / PostgreSQL)
create table if not exists trucks (
  id text primary key,
  name text not null,
  cuisine text not null default 'Fusion',
  description text default '',
  image_emoji text default '🚚',
  rating numeric default 4.5,
  price_level int default 1,
  tags text[] default '{}',
  phone text default '',
  status text default 'prep',
  current_location text default 'Depot',
  next_location text default '',
  created_at timestamptz default now()
);

create table if not exists schedules (
  id text primary key,
  truck_id text references trucks(id) on delete cascade,
  day text not null,
  date date,
  start_time text not null,
  end_time text not null,
  location text not null,
  address text default '',
  notes text default '',
  status text default 'open'
);

create table if not exists menu_items (
  id text primary key,
  truck_id text references trucks(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric not null default 8.99,
  category text default 'Mains',
  is_veg boolean default false,
  is_spicy boolean default false,
  is_special boolean default false,
  available boolean default true,
  calories int
);

-- realtime
alter publication supabase_realtime add table trucks;
alter publication supabase_realtime add table schedules;
alter publication supabase_realtime add table menu_items;

-- open read for demo (tighten in production with RLS policies)
alter table trucks enable row level security;
alter table schedules enable row level security;
alter table menu_items enable row level security;
create policy "public read" on trucks for select using (true);
create policy "public read" on schedules for select using (true);
create policy "public read" on menu_items for select using (true);
create policy "public write" on trucks for all using (true) with check (true);
create policy "public write" on schedules for all using (true) with check (true);
create policy "public write" on menu_items for all using (true) with check (true);
