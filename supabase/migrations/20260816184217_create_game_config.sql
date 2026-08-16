/*
# Game configuration table

Stores operator-configured values (treasury address, node URL) that edge functions
read at runtime. Edge functions cannot have secrets set through the available tooling,
so this table acts as the configuration source. Only the service role can write here;
all authenticated players can read the treasury address (it is public by nature).
*/

CREATE TABLE IF NOT EXISTS game_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_game_config" ON game_config;
CREATE POLICY "authenticated_read_game_config" ON game_config FOR SELECT
  TO authenticated USING (true);

INSERT INTO game_config (key, value) VALUES
  ('atto_treasury_address', 'atto://acmnyfgc57qflblb4kv47syh76etrq6l4wartna56ntusq6of3ed2zkuup3cu')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
