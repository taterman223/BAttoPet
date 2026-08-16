```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Player } from "./supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  player: Player | null;
  loading: boolean;
  signIn: (
    username: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    username: string,
    password: string,
    attoAddress: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlayer = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (error || !data) {
      setPlayer(null);
      return;
    }

    setPlayer(data as Player);

    await supabase
      .from("players")
      .update({
        last_login: new Date().toISOString(),
      })
      .eq("id", uid);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        loadPlayer(data.session.user.id).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          loadPlayer(sess.user.id);
        } else {
          setPlayer(null);
        }
      }
    );

    return () => sub.subscription.unsubscribe();
  }, [loadPlayer]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const cleanUsername = username.trim().toLowerCase();
      const email = cleanUsername + "@atto-pets.local";

      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      return {
        error: error?.message ?? null,
      };
    },
    []
  );

  const signUp = useCallback(
    async (
      username: string,
      password: string,
      attoAddress: string
    ) => {
      const cleanUsername = username.trim();

      const url =
        import.meta.env.VITE_SUPABASE_URL +
        "/functions/v1/signup";

      const anonKey =
        import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + anonKey,
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: password,
          atto_address: attoAddress,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          error: data.error ?? "Sign-up failed.",
        };
      }

      const email =
        cleanUsername.toLowerCase() +
        "@atto-pets.local";

      const { error: loginErr } =
        await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

      return {
        error: loginErr?.message ?? null,
      };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setPlayer(null);
  }, []);

  const refreshPlayer = useCallback(async () => {
    if (user) {
      await loadPlayer(user.id);
    }
  }, [user, loadPlayer]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        player,
        loading,
        signIn,
        signUp,
        signOut,
        refreshPlayer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return ctx;
}
```
