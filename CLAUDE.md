# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static recipe browser: filter recipes by search term, max cook time, servings, and ingredients on hand, plus a monthly meal-plan calendar. No build step, no bundler, no package.json — `index.html` + `app.js` + `style.css` loaded directly in a browser.

## Running it

Open `index.html` directly in a browser, or serve the folder with any static file server. There is no test suite, linter, or build command.

## Architecture

**Data flow**: `app.js` is a single IIFE that runs top-to-bottom at load. It loads the recipe list once (from Supabase if configured, otherwise `data/recipes.json`), then does all filtering/searching/rendering client-side against the in-memory array — nothing is re-queried from the database after the initial load. Two independent views share this data and are toggled by the tabs in `index.html`:
- **Recipes view**: search/filter form → `matchesSearch` / `ingredientMatch` → grid render.
- **Meal Plan view**: a month calendar backed by `localStorage` (key `recipeManager.mealPlan`), mapping date strings (`YYYY-MM-DD`) to arrays of recipe IDs. Recipe lookups by ID go through the `recipesById` Map built at load time.

**Optional Supabase backend** (`supabase/` directory): when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are filled in near the top of `app.js`, recipes load from a Supabase `recipes` table instead of the static JSON, and the "Add recipe" dialog becomes enabled. Apply the SQL files in this order against a Supabase project's SQL editor:
1. `schema.sql` — creates the table and RLS policies (public read, public insert, **no update/delete** — the table is add-only from the live site).
2. `seed.sql` — loads the current 75 recipes (`on conflict (id) do nothing`, safe to re-run).
3. `harden.sql` — adds CHECK constraints capping field/array sizes, since the public anon key can hit the PostgREST API directly and bypass any client-side form validation. Does **not** cover volume-based spam (many small valid-looking rows) — that would need bot verification (e.g. Turnstile) in front of an Edge Function.

The anon/publishable key is meant to be public and safe to commit; a `service_role` key must never go in client code. All Supabase calls in `app.js` go through the object-based `supabase-js` API (`.select()`, `.insert()`), which PostgREST parameterizes — avoid introducing raw filter-string interpolation (e.g. `.or(`name.ilike.%${x}%`)`) without sanitizing it first.

## Recipe data shape

Each recipe (`data/recipes.json` or the `recipes` table) has: `id` (slug), `name`, `category` (array), `cuisine`, `cookTime`/`prepTime`/`totalTime` (minutes), `rating`, `servings`, `source`, `tags` (array), `tried` (bool), `ingredients` (array of lines), `instructions` (array of lines), `notes`. New recipes added via the UI generate their `id` as `${slugify(name)}-${Date.now().toString(36)}`.
