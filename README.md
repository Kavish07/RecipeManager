# Recipe Manager

A static recipe browser: filter recipes by search term, max cook time, servings, and ingredients you already have, plus a meal-plan view.

## Running it

No build step — open `index.html` directly in a browser, or serve the folder with any static file server.

Recipes load from `data/recipes.json` by default.

## Optional Supabase backend

To store recipes in a shared database (and allow visitors to add their own) instead of the static JSON file:

1. Create a Supabase project and run `supabase/schema.sql` then `supabase/seed.sql` in its SQL editor.
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of `app.js`.

With RLS as defined in `schema.sql`, the table is add-only from the live site (no public update/delete).

## Project files

- `index.html`, `style.css`, `app.js` — the app
- `data/recipes.json` — default recipe data
- `supabase/` — schema and seed SQL for the optional Supabase backend
- `docs/` — source recipe list (xlsx/csv)
