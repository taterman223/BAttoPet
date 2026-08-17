/*
# Server-side pet generator

Creates `generate_pet(p_owner uuid, p_tier text)` - a SECURITY DEFINER function that
builds a unique pet (name, species, appearance, personality, description, exactly one
passive ability, and authoritative combat stats scaled to the tier), inserts it into
`pets`, and returns the new row.

## Security
- SECURITY DEFINER so it can insert regardless of RLS.
- EXECUTE is granted to NO client roles (not anon, not authenticated). Only the service
  role used by edge functions can call it, so players can never generate pets or choose
  their own stats/passive/tier.
- search_path pinned to public.

## Notes
1. Stats scale with tier index (Worthless=1 ... Excellent=6) plus randomness, so pets
   vary within a tier while higher tiers are generally stronger.
2. Exactly one passive is selected from a fixed pool; its effect is stored as jsonb and
   is interpreted authoritatively by the battle engine.
*/

CREATE OR REPLACE FUNCTION generate_pet(p_owner uuid, p_tier text)
RETURNS pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t int;
  prefixes text[] := ARRAY['Zy','Mor','Vel','Thra','Lumi','Kor','Nyx','Aer','Bro','Cin','Dra','Ely','Fen','Gla','Hex','Ith','Jor','Kel','Lox','Myr','Umb','Vor','Wisp','Xan','Yol','Zeph'];
  mids text[] := ARRAY['a','e','i','o','u','ae','io','ou','yr','al','en','ir'];
  suffixes text[] := ARRAY['xis','mor','tha','lok','vyn','dra','pex','lith','wyn','gore','fang','mit','pod','claw','tail','zar'];
  species_pool text[] := ARRAY['Flame Drake','Crystal Fox','Shadow Lynx','Storm Serpent','Moss Golem','Aether Moth','Frost Hound','Ember Sprite','Tide Kraken','Dune Beetle','Void Owl','Glimmer Slime','Thorn Boar','Static Eel','Cloud Ram','Cinder Bat','Coral Newt','Bramble Stag','Ash Raven','Lumen Jelly'];
  colors text[] := ARRAY['iridescent','obsidian','pale-gold','crimson','teal','frost-white','emerald','amber','violet-black','silver','copper','sea-green'];
  textures text[] := ARRAY['scaled','feathered','crystalline','smoky','furred','glassy','plated','glowing','mossy','translucent'];
  traits text[] := ARRAY['brave','skittish','curious','stoic','playful','vengeful','loyal','aloof','reckless','gentle','cunning','proud'];
  quirks text[] := ARRAY['hums when calm','hoards shiny stones','sleeps upside down','fears thunder','loves rainstorms','never blinks','glows at dusk','collects feathers','purrs during battle','hates cold water'];
  pnames text[] := ARRAY['Critical Instinct','Iron Hide','Bloodthirst','Lightning Reflexes','Barbed Coat','Executioner','Living Spring','Frenzy'];
  pdescs text[] := ARRAY[
    'Sharpens its focus, raising the chance to land critical strikes.',
    'A hardened body reduces all incoming damage.',
    'Drains vitality from foes, healing a portion of damage dealt.',
    'Reflexes so fast this pet always strikes first.',
    'Sharp barbs reflect part of any damage taken back at the attacker.',
    'Deals bonus damage to badly wounded enemies.',
    'Slowly regenerates health at the start of each of its turns.',
    'A wild frenzy raises the chance to strike multiple times.'
  ];
  peffects jsonb[];
  idx int;
  nm text;
  result pets;
BEGIN
  t := CASE p_tier
        WHEN 'Worthless' THEN 1 WHEN 'Average' THEN 2 WHEN 'Decent' THEN 3
        WHEN 'Good' THEN 4 WHEN 'Fabulous' THEN 5 WHEN 'Excellent' THEN 6 ELSE 2 END;

  peffects := ARRAY[
    jsonb_build_object('type','crit_up','value', round((0.10 + t*0.02)::numeric, 3)),
    jsonb_build_object('type','damage_reduction','value', round((0.08 + t*0.02)::numeric, 3)),
    jsonb_build_object('type','lifesteal','value', round((0.12 + t*0.03)::numeric, 3)),
    jsonb_build_object('type','first_strike','value', 0),
    jsonb_build_object('type','thorns','value', round((0.10 + t*0.03)::numeric, 3)),
    jsonb_build_object('type','execute','value', round((0.10 + t*0.03)::numeric, 3)),
    jsonb_build_object('type','regen','value', round((0.04 + t*0.01)::numeric, 3)),
    jsonb_build_object('type','multi_up','value', round((0.10 + t*0.02)::numeric, 3))
  ];

  nm := prefixes[1 + floor(random()*array_length(prefixes,1))::int]
      || mids[1 + floor(random()*array_length(mids,1))::int]
      || suffixes[1 + floor(random()*array_length(suffixes,1))::int];

  idx := 1 + floor(random()*array_length(pnames,1))::int;

  INSERT INTO pets (
    owner_id, name, species, tier, appearance, personality, description,
    passive_name, passive_description, passive_effect,
    attack, defense, speed, max_health, crit_chance, multi_attack_chance,
    tradeable, is_clone, in_battle
  ) VALUES (
    p_owner,
    nm,
    species_pool[1 + floor(random()*array_length(species_pool,1))::int],
    p_tier,
    'A ' || textures[1 + floor(random()*array_length(textures,1))::int] || ', '
      || colors[1 + floor(random()*array_length(colors,1))::int] || ' creature',
    traits[1 + floor(random()*array_length(traits,1))::int] || ', and it '
      || quirks[1 + floor(random()*array_length(quirks,1))::int],
    nm || ' is a ' || p_tier || '-tier companion born from the ATTO network, unlike any other.',
    pnames[idx],
    pdescs[idx],
    peffects[idx],
    (8  + t*5  + floor(random()*7))::int,
    (5  + t*4  + floor(random()*6))::int,
    (6  + t*4  + floor(random()*7))::int,
    (60 + t*22 + floor(random()*26))::int,
    round((0.03 + t*0.02 + random()*0.03)::numeric, 3),
    round((0.02 + t*0.015 + random()*0.02)::numeric, 3),
    true, false, false
  ) RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION generate_pet(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_pet(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION generate_pet(uuid, text) FROM authenticated;
