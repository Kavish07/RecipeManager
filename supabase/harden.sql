-- Run once in the Supabase SQL editor, after schema.sql.
-- Caps field sizes on public inserts so the add-only "recipes" table can't be
-- flooded with oversized junk via the public key (the REST API is reachable
-- directly, so this must live in the database, not just the add-recipe form).
alter table recipes
  add constraint recipes_name_sane check (char_length(name) between 1 and 200),
  add constraint recipes_id_sane check (char_length(id) between 1 and 150),
  add constraint recipes_notes_sane check (notes is null or char_length(notes) <= 2000),
  add constraint recipes_category_sane check (cardinality(category) <= 10),
  add constraint recipes_tags_sane check (cardinality(tags) <= 10),
  add constraint recipes_ingredients_sane check (cardinality(ingredients) <= 50),
  add constraint recipes_instructions_sane check (cardinality(instructions) <= 50);

-- Not covered: volume spam (many small, valid-looking rows). Blocking that
-- needs bot verification (e.g. Cloudflare Turnstile) in front of an Edge
-- Function, since Postgres has no native rate limiting.
