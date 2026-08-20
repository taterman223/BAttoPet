import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Battle = {
  id: string;
  creator_id: string;
  creator_pet_id: string;
  creator_current_hp: number;
  joiner_id: string | null;
  joiner_pet_id: string | null;
  joiner_current_hp: number | null;
  current_turn_player_id: string | null;
  round_number: number;
  status: string;
  winner_id: string | null;
  winner_name: string | null;
};

type Pet = {
  id: string;
  name: string;
  species?: string | null;
  tier: string;
  attack: number;
  defense: number;
  max_health: number;
  crit_chance: number;
  multi_attack_chance: number;
  passive_effect?: {
    type?: string;
    value?: number;
  } | null;
};

type CombatLog = {
  id: string;
  message: string;
  round_number: number;
};

export default function BattleArena() {
  const [userId, setUserId] = useState<string | null>(null);
  const [pet, setPet] = useState<Pet | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [battleIdInput, setBattleIdInput] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    setUserId(user.id);
  }

  async function loadPet(petId: string) {
    const { data, error } = await supabase
      .from("pets")
      .select(`
        id,
        name,
        species,
        tier,
        attack,
        defense,
        max_health,
        crit_chance,
        multi_attack_chance,
        passive_effect
      `)
      .eq("id", petId)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    setPet(data as Pet);
  }

  async function callBattle(
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage("You must be signed in.");
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/battle`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action,
            ...extra,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.details ||
            "Battle request failed.",
        );
      }

      return data;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Battle request failed.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function createBattle() {
    if (!pet) {
      setMessage("Select a pet first.");
      return;
    }

    const result = await callBattle("create", {
      pet_id: pet.id,
    });

    if (!result) return;

    setMessage(`Battle created! ID: ${result.battle_id}`);

    await loadBattle(result.battle_id);
  }

  async function joinBattle() {
    if (!pet) {
      setMessage("Select a pet first.");
      return;
    }

    if (!battleIdInput.trim()) {
      setMessage("Enter a battle ID.");
      return;
    }

    const result = await callBattle("join", {
      battle_id: battleIdInput.trim(),
      pet_id: pet.id,
    });

    if (!result) return;

    setMessage("Battle joined!");

    await loadBattle(battleIdInput.trim());
  }

  async function attack() {
    if (!battle) return;

    const result = await callBattle("attack", {
      battle_id: battle.id,
    });

    if (!result) return;

    await loadBattle(battle.id);

    if (result.finished) {
      setMessage("Battle finished!");
    }
  }

  async function cancelBattle() {
    if (!battle) return;

    const result = await callBattle("cancel", {
      battle_id: battle.id,
    });

    if (!result) return;

    setBattle(null);
    setLogs([]);
    setMessage("Battle cancelled.");
  }

  async function loadBattle(id: string) {
    const { data, error } = await supabase
      .from("battles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Battle not found.");
      return;
    }

    setBattle(data as Battle);

    await loadBattleLogs(id);

    if (data.creator_pet_id) {
      await loadPet(data.creator_pet_id);
    }
  }

  async function loadBattleLogs(id: string) {
    const { data, error } = await supabase
      .from("battle_combat_logs")
      .select("id, message, round_number")
      .eq("battle_id", id)
      .order("id", {
        ascending: true,
      });

    if (!error && data) {
      setLogs(data as CombatLog[]);
    }
  }

  const isMyTurn =
    !!battle &&
    !!userId &&
    battle.current_turn_player_id === userId;

  const battleFinished =
    battle?.status === "finished";

  const iAmCreator =
    !!battle &&
    !!userId &&
    battle.creator_id === userId;

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px",
        background: "#111",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <h1>⚔️ Battle Arena</h1>

        {message && (
          <div
            style={{
              padding: "12px",
              marginBottom: "20px",
              background: "#222",
              borderRadius: "8px",
            }}
          >
            {message}
          </div>
        )}

        {!pet && (
          <PetSelector
            userId={userId}
            onSelect={(selectedPet) => {
              setPet(selectedPet);
              setMessage(
                `Selected ${selectedPet.name}`,
              );
            }}
          />
        )}

        {pet && !battle && (
          <div
            style={{
              padding: "20px",
              background: "#1c1c1c",
              borderRadius: "12px",
              marginBottom: "20px",
            }}
          >
            <h2>
              Selected Pet: {pet.name}
            </h2>

            <p>
              Tier: {pet.tier}
            </p>

            <p>
              ⚔️ Attack: {pet.attack}
            </p>

            <p>
              🛡️ Defense: {pet.defense}
            </p>

            <p>
              ❤️ Health: {pet.max_health}
            </p>

            <button
              onClick={createBattle}
              disabled={loading}
              style={buttonStyle}
            >
              {loading
                ? "Creating..."
                : "Create Battle"}
            </button>

            <div
              style={{
                marginTop: "25px",
              }}
            >
              <input
                value={battleIdInput}
                onChange={(e) =>
                  setBattleIdInput(
                    e.target.value,
                  )
                }
                placeholder="Enter Battle ID"
                style={inputStyle}
              />

              <button
                onClick={joinBattle}
                disabled={loading}
                style={buttonStyle}
              >
                {loading
                  ? "Joining..."
                  : "Join Battle"}
              </button>
            </div>
          </div>
        )}

        {battle && (
          <>
            <div
              style={{
                padding: "20px",
                background: "#1c1c1c",
                borderRadius: "12px",
                marginBottom: "20px",
              }}
            >
              <h2>
                Battle: {battle.id}
              </h2>

              <p>
                Status: {battle.status}
              </p>

              <p>
                Round: {battle.round_number}
              </p>

              {battle.status ===
                "waiting" && (
                <>
                  <p>
                    Waiting for another
                    player...
                  </p>

                  {iAmCreator && (
                    <button
                      onClick={
                        cancelBattle
                      }
                      disabled={loading}
                      style={buttonStyle}
                    >
                      Cancel Battle
                    </button>
                  )}
                </>
              )}

              {battle.status ===
                "active" && (
                <>
                  <h3>
                    {isMyTurn
                      ? "🔥 YOUR TURN"
                      : "⏳ Waiting for opponent..."}
                  </h3>

                  <button
                    onClick={attack}
                    disabled={
                      loading ||
                      !isMyTurn
                    }
                    style={{
                      ...buttonStyle,
                      opacity:
                        isMyTurn
                          ? 1
                          : 0.5,
                    }}
                  >
                    {loading
                      ? "Attacking..."
                      : "⚔️ ATTACK"}
                  </button>
                </>
              )}

              {battleFinished && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "15px",
                    background: "#252525",
                    borderRadius: "8px",
                  }}
                >
                  <h2>
                    🏆 Battle Finished
                  </h2>

                  <p>
                    Winner:{" "}
                    {battle.winner_name ??
                      "Unknown"}
                  </p>

                  {battle.winner_id ===
                    userId ? (
                    <p>
                      You won! Your clone
                      reward has been created.
                    </p>
                  ) : (
                    <p>
                      You lost. Your pet is
                      battle-locked for 24 hours.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                padding: "20px",
                background: "#1c1c1c",
                borderRadius: "12px",
              }}
            >
              <h2>📜 Combat Log</h2>

              {logs.length === 0 ? (
                <p>
                  No combat actions yet.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "8px 0",
                      borderBottom:
                        "1px solid #333",
                    }}
                  >
                    <span
                      style={{
                        opacity: 0.6,
                      }}
                    >
                      Round{" "}
                      {log.round_number}:{" "}
                    </span>

                    {log.message}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PetSelector({
  userId,
  onSelect,
}: {
  userId: string | null;
  onSelect: (pet: Pet) => void;
}) {
  const [pets, setPets] = useState<Pet[]>(
    [],
  );
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (!userId) return;

    loadPets();
  }, [userId]);

  async function loadPets() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("pets")
        .select(`
          id,
          name,
          species,
          tier,
          attack,
          defense,
          max_health,
          crit_chance,
          multi_attack_chance,
          passive_effect
        `)
        .eq("owner_id", userId)
        .eq("in_battle", false)
        .order("name");

    if (!error && data) {
      setPets(data as Pet[]);
    }

    setLoading(false);
  }

  if (!userId) {
    return (
      <p>
        Please sign in to battle.
      </p>
    );
  }

  if (loading) {
    return <p>Loading pets...</p>;
  }

  if (pets.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          background: "#1c1c1c",
          borderRadius: "12px",
        }}
      >
        <h2>No available pets</h2>
        <p>
          You don't currently have a pet
          available for battle.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: "20px",
      }}
    >
      <h2>Select your pet</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "15px",
        }}
      >
        {pets.map((pet) => (
          <button
            key={pet.id}
            onClick={() =>
              onSelect(pet)
            }
            style={{
              background: "#1c1c1c",
              color: "white",
              border: "1px solid #444",
              borderRadius: "12px",
              padding: "18px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <h3>{pet.name}</h3>

            <p>
              Tier: {pet.tier}
            </p>

            <p>
              ⚔️ {pet.attack} ATK
            </p>

            <p>
              🛡️ {pet.defense} DEF
            </p>

            <p>
              ❤️ {pet.max_health} HP
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "12px 18px",
  border: "none",
  borderRadius: "8px",
  background: "#4f46e5",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginRight: "10px",
};

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #555",
  background: "#111",
  color: "white",
  marginRight: "10px",
  width: "280px",
};
