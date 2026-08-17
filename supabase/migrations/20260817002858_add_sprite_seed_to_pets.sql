/*
# Add sprite_seed column to pets

## Changes
- Adds `sprite_seed` (integer) to the `pets` table. Each pet gets a random
  integer seed at creation time that the frontend uses to procedurally
  generate a unique pixel-art creature avatar. No two pets will look the same.
- Backfills existing pets with random seeds.

## Security
- No RLS or policy changes. The column is read-only to clients (no INSERT/UPDATE
  policies exist on pets — only the service role writes via edge functions).
*/

ALTER TABLE pets ADD COLUMN IF NOT EXISTS sprite_seed integer NOT NULL DEFAULT 0;

-- Backfill existing pets with random seeds
UPDATE pets SET sprite_seed = floor(random() * 2147483647)::int WHERE sprite_seed = 0;
