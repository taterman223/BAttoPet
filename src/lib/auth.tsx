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

```
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
```

}, []);

useEffect(() => {
let mounted = true;

```
supabase.auth.getSession().then(({ data }) => {
  if (!mounted) return;

  setSession(data.session);
  setUser(data.session?.user ?? null);

  if (data.session?.user) {
    loadPlayer(data.session.user.id).finally(() => {
      if (mounted) {
        setLoading(false);
      }
    });
  } else {
    setLoading(false);
  }
});

const { data: subscription } =
  supabase.auth.onAuthStateChange((_event, sess) => {
    if (!mounted) return;

    setSession(sess);
    setUser(sess?.user ?? null);

    if (sess?.user) {
      loadPlayer(sess.user.id);
    } else {
      setPlayer(null);
    }
  });

return () => {
  mounted = false;
  subscription.subscription.unsubscribe();
};
```

}, [loadPlayer]);

const signIn = useCallback(
async (username: string, password: string) => {
try {
const cleanUsername = username.trim().toLowerCase();
const email = `${cleanUsername}@atto-pets.local`;

```
    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    return {
      error: error?.message ?? null,
    };
  } catch (error) {
    console.error("Sign-in failed:", error);

    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not sign in.",
    };
  }
},
[]
```

);

const signUp = useCallback(
async (
username: string,
password: string,
attoAddress: string
) => {
try {
const cleanUsername = username.trim();

```
    const supabaseUrl =
      import.meta.env.VITE_SUPABASE_URL;

    const anonKey =
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return {
        error:
          "VITE_SUPABASE_URL is not configured in Vercel.",
      };
    }

    if (!anonKey) {
      return {
        error:
          "VITE_SUPABASE_ANON_KEY is not configured in Vercel.",
      };
    }

    const url =
      supabaseUrl.replace(/\/$/, "") +
      "/functions/v1/signup";

    console.log("Calling signup function:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        username: cleanUsername,
        password,
        atto_address: attoAddress,
      }),
    });

    const text = await response.text();

    let data: { error?: string } = {};

    try {
      data = JSON.parse(text);
    } catch {
      // The server did not return JSON.
    }

    if (!response.ok) {
      console.error(
        "Signup function returned an error:",
        response.status,
        text
      );

      return {
        error:
          data.error ||
          `Signup failed (${response.status}). ${text}`,
      };
    }

    const email =
      cleanUsername.toLowerCase() +
      "@atto-pets.local";

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      return {
        error: loginError.message,
      };
    }

    return {
      error: null,
    };
  } catch (error) {
    console.error("Signup request failed:", error);

    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not connect to the signup server.",
    };
  }
},
[]
```

);

const signOut = useCallback(async () => {
await supabase.auth.signOut();

```
setPlayer(null);
setUser(null);
setSession(null);
```

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

export function useAuth(): AuthState {
const context = useContext(AuthContext);

if (!context) {
throw new Error(
"useAuth must be used within AuthProvider"
);
}

return context;
}
