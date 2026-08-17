/*
# Update generate_pet to add sprite_seed and richer variety

## Changes
- Updates `generate_pet()` to set `sprite_seed` to a random integer on each new pet.
- Expands the species pool from 20 to 40 unique species for more variety.
- Expands prefix/mid/suffix arrays for more unique name combinations.
- Adds more appearance textures, colors, traits, and quirks.
- All existing behavior (tier scaling, passive selection, stat formulas) is preserved.

## Security
- No RLS or policy changes. Function remains SECURITY DEFINER, EXECUTE revoked
  from all client roles — only the service role can call it.
*/

CREATE OR REPLACE FUNCTION generate_pet(p_owner uuid, p_tier text)
RETURNS pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t int;
  prefixes text[] := ARRAY['Zy','Mor','Vel','Thra','Lumi','Kor','Nyx','Aer','Bro','Cin','Dra','Ely','Fen','Gla','Hex','Ith','Jor','Kel','Lox','Myr','Umb','Vor','Wisp','Xan','Yol','Zeph','Baz','Quil','Syl','Tor','Vex','Wryn','Pyx','Drak','Fael','Grim','Hesh','Ivo','Jyn','Kry'];
  mids text[] := ARRAY['a','e','i','o','u','ae','io','ou','yr','al','en','ir','ix','orn','ul','ash','eth','om','un','yl'];
  suffixes text[] := ARRAY['xis','mor','tha','lok','vyn','dra','pex','lith','wyn','gore','fang','mit','pod','claw','tail','zar','nix','roar','scale','horn','wing','eye','maw','pelt','shard','bloom','crest','spire','gale','rune'];
  species_pool text[] := ARRAY[
    'Flame Drake','Crystal Fox','Shadow Lynx','Storm Serpent','Moss Golem',
    'Aether Moth','Frost Hound','Ember Sprite','Tide Kraken','Dune Beetle',
    'Void Owl','Glimmer Slime','Thorn Boar','Static Eel','Cloud Ram',
    'Cinder Bat','Coral Newt','Bramble Stag','Ash Raven','Lumen Jelly',
    'Frost Wisp','Magma Toad','Hex Scorpion','Vine Python','Dusk Falcon',
    'Glass Mantis','Rust Hound','Plume Heron','Shard Crab','Wraith Koi',
    'Bolt Weasel','Gale Sparrow','Marsh Imp','Ember Lynx','Frost Stag',
    'Quartz Badger','Smog Rat','Tide Urchin','Gloom Fern','Spark Finch'
  ];
  colors text[] := ARRAY['iridescent','obsidian','pale-gold','crimson','teal','frost-white','emerald','amber','violet-black','silver','copper','sea-green','molten-orange','deep-indigo','sandy-gold','rose-quartz','slate-gray','burnt-sienna','jade','sapphire'];
  textures text[] := ARRAY['scaled','feathered','crystalline','smoky','furred','glassy','plated','glowing','mossy','translucent','striped','spotted','marbled','tessellated','fibrous','metallic','gaseous','porous'];
  traits text[] := ARRAY['brave','skittish','curious','stoic','playful','vengeful','loyal','aloof','reckless','gentle','cunning','proud','timid','aggressive','wise','mischievous','solemn','energetic','cautious','fearless'];
  quirks text[] := ARRAY['hums when calm','hoards shiny stones','sleeps upside down','fears thunder','loves rainstorms','never blinks','glows at dusk','collects feathers','purrs during battle','hates cold water','digs burrows constantly','sings to the moon','hordes bones','walks in circles before sleeping','flicks its tail when lying','snorts fire when angry','leaves a trail of sparks','can mimic bird calls','changes color when happy','curls into a ball when scared'];
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
  sp_idx int;
  result pets;
  seed int;
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

  sp_idx := 1 + floor(random()*array_length(species_pool,1))::int;
  idx := 1 + floor(random()*array_length(pnames,1))::int;
  seed := floor(random() * 2147483647)::int;

  INSERT INTO pets (
    owner_id, name, species, tier, appearance, personality, description,
    passive_name, passive_description, passive_effect,
    attack, defense, speed, max_health, crit_chance, multi_attack_chance,
    tradeable, is_clone, in_battle, sprite_seed
  ) VALUES (
    p_owner,
    nm,
    species_pool[sp_idx],
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
    true, false, false,
    seed
  ) RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION generate_pet(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION generate_pet(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION generate_pet(uuid, text) FROM authenticated;
