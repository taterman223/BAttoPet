import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/lib/ui";
import { PawPrint, Wallet } from "lucide-react";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [attoAddress, setAttoAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        const result = await signIn(username, password);

        if (result.error) {
          setError(result.error);
        }
      } else {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          setError(
            "Username must be 3-20 letters, numbers or underscores."
          );
          return;
        }

        if (!/^atto:\/\/[a-z2-7]{61}$/.test(attoAddress)) {
          setError(
            "Enter a valid ATTO address (atto:// followed by 61 characters)."
          );
          return;
        }

        const result = await signUp(
          username,
          password,
          attoAddress
        );

        if (result.error) {
          setError(result.error);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-sky-50 to-slate-100">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 shadow-lg mb-4">
            <PawPrint className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            ATTO Pets
          </h1>

          <p className="text-slate-500 mt-1 text-sm">
            Collect, trade, and battle AI-generated pets on the ATTO network
          </p>
        </div>

        <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl shadow-xl p-6">
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={
                mode === "signin"
                  ? "flex-1 py-2 rounded-md text-sm font-medium transition bg-sky-600 text-white shadow-sm"
                  : "flex-1 py-2 rounded-md text-sm font-medium transition text-slate-500 hover:text-slate-800"
              }
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={
                mode === "signup"
                  ? "flex-1 py-2 rounded-md text-sm font-medium transition bg-sky-600 text-white shadow-sm"
                  : "flex-1 py-2 rounded-md text-sm font-medium transition text-slate-500 hover:text-slate-800"
              }
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                autoComplete="username"
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                placeholder="3-20 letters, numbers, underscores"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={
                  mode === "signin"
                    ? "current-password"
                    : "new-password"
                }
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                placeholder="At least 6 characters"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    ATTO Wallet Address
                  </span>
                </label>

                <input
                  type="text"
                  value={attoAddress}
                  onChange={(e) => setAttoAddress(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                  placeholder="atto://..."
                />

                <p className="text-[11px] text-slate-400 mt-1">
                  Your external ATTO wallet address. We never ask for your
                  private key or seed phrase.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-semibold rounded-lg transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy && <Spinner size={16} />}
              {mode === "signin"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Non-custodial. Payments verified on the real ATTO network.
        </p>
      </div>
    </div>
  );
}


