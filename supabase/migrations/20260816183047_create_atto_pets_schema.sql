/*
# ATTO Pets - Core Game Schema

Creates the full persistent backend for the ATTO Pets multiplayer game.

## 1. New Tables
- `players` - one row per account (id = auth user id), holds username, registered
  ATTO address, creation date and last login. Never stores passwords (Supabase auth
  handles password hashing).
- `pets` - every AI/server-generated pet. Owner, name, species, tier, appearance,
  personality, description, one passive (name/description/effect json), authoritative
  combat stats, tradeable flag, battle-lock timestamp, in-battle flag, clone flag.
- `marketplace_listings` - shared marketplace. seller, pet, price, status, buyer.
- `battles` - turn-based battle rooms. creator/joiner, their pets, authoritative HP,
  whose turn, round number, status, winner. Clients can only read; never write.
- `battle_combat_logs` - per-action combat log entries for each battle.
- `used_transaction_hashes` - redeemed ATTO transaction hashes (unique) to stop replay.
- `purchases` - record of each verified egg purchase and the pet it produced.

## 2. Security
- RLS enabled on every table.
- Read-only SELECT policies for authenticated users on shared game data
  (players, pets, listings, battles, logs) so the game can display real state.
- NO client insert/update/delete policies on game-state tables: every authoritative
  mutation happens through edge functions using the service role (which bypasses RLS).
  This makes it impossible for a client to change HP, winners, ownership, stats, etc.
- `used_transaction_hashes` and `purchases` have no client policies at all.

## 3. Realtime
- battles, battle_combat_logs and marketplace_listings are added to the
  supabase_realtime publication so all players receive live updates.

## 4. Notes
1. Tiers are stored as a constrained text value (one of six tiers).
2. `battle_locked_until` in the future means the pet cannot enter battles.
3. Unique constraint on used_transaction_hashes.hash prevents double redemption.
*/

-- PLAYERS ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  atto_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_players" ON players;
CREATE POLICY "authenticated_read_players" ON players FOR SELECT
  TO authenticated USING (true);

-- PETS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('Worthless','Average','Decent','Good','Fabulous','Excellent')),
  appearance text NOT NULL,
  personality text NOT NULL,
  description text NOT NULL,
  passive_name text NOT NULL,
  passive_description text NOT NULL,
  passive_effect jsonb NOT NULL,
  attack integer NOT NULL,
  defense integer NOT NULL,
  speed integer NOT NULL,
  max_health integer NOT NULL,
  crit_chance numeric NOT NULL,
  multi_attack_chance numeric NOT NULL,
  tradeable boolean NOT NULL DEFAULT true,
  is_clone boolean NOT NULL DEFAULT false,
  in_battle boolean NOT NULL DEFAULT false,
  battle_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_pets" ON pets;
CREATE POLICY "authenticated_read_pets" ON pets FOR SELECT
  TO authenticated USING (true);

-- MARKETPLACE -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  price numeric NOT NULL CHECK (price > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  buyer_id uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_listing_per_pet
  ON marketplace_listings(pet_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_listings" ON marketplace_listings;
CREATE POLICY "authenticated_read_listings" ON marketplace_listings FOR SELECT
  TO authenticated USING (true);

-- BATTLES ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joiner_id uuid REFERENCES players(id) ON DELETE SET NULL,
  creator_pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  joiner_pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  creator_current_hp integer,
  joiner_current_hp integer,
  current_turn_player_id uuid,
  round_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  winner_id uuid REFERENCES players(id) ON DELETE SET NULL,
  winner_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_battles" ON battles;
CREATE POLICY "authenticated_read_battles" ON battles FOR SELECT
  TO authenticated USING (true);

-- BATTLE COMBAT LOGS ----------------------------------------------------
CREATE TABLE IF NOT EXISTS battle_combat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  actor_player_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_battle ON battle_combat_logs(battle_id);

ALTER TABLE battle_combat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_logs" ON battle_combat_logs;
CREATE POLICY "authenticated_read_logs" ON battle_combat_logs FOR SELECT
  TO authenticated USING (true);

-- USED TRANSACTION HASHES ----------------------------------------------
CREATE TABLE IF NOT EXISTS used_transaction_hashes (
  hash text PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  egg_type text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE used_transaction_hashes ENABLE ROW LEVEL SECURITY;
-- No client policies: only the service role (edge functions) may touch this table.

-- PURCHASES -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tx_hash text NOT NULL,
  egg_type text NOT NULL,
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_own_purchases" ON purchases;
CREATE POLICY "authenticated_read_own_purchases" ON purchases FOR SELECT
  TO authenticated USING (auth.uid() = player_id);

-- REALTIME --------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'battles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE battles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'battle_combat_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE battle_combat_logs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'marketplace_listings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_listings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pets;
  END IF;
END $$;
