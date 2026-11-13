-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
create table if not exists recipes (
  id text primary key,
  name text not null,
  category text[] not null default '{}',
  cuisine text,
  "cookTime" integer,
  "prepTime" integer,
  "totalTime" integer,
  rating numeric,
  servings integer default 4,
  source text default '',
  tags text[] not null default '{}',
  tried boolean default false,
  ingredients text[] not null default '{}',
  instructions text[] not null default '{}',
  notes text
);

alter table recipes enable row level security;

-- Anyone (using the public anon key) can read all recipes.
create policy "Public can read recipes" on recipes
  for select using (true);

-- Anyone can add a new recipe.
create policy "Public can add recipes" on recipes
  for insert with check (true);

-- No update/delete policy is created, so those operations are
-- blocked for the public anon key once row level security is on:
-- this table is add-only from the live site.
