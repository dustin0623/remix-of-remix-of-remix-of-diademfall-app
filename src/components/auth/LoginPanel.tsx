import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { usernameError } from "@/lib/account/username";
import { divisionFor } from "@/game/divisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup" | "forgot" | "sent";

export function LoginPanel({ onDone }: { onDone?: () => void }) {
  const { user, account, loading } = useAccount();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("login");
  const [sentText, setSentText] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(null); };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    onDone?.();
  };

  if (user) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-display text-2xl font-bold text-foreground">{account?.displayName ?? (loading ? "…" : user.email)}</p>
        {account && <p className="text-xs text-muted-foreground">@{account.username} · {user.email}</p>}
        {account && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Division", divisionFor(account.rating)], ["Rating", account.rating], ["Cards", account.cardsOwned]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-background/50 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="font-display text-sm font-bold text-primary">{v}</div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" onClick={signOut}>Log out</Button>
      </div>
    );
  }

  if (mode === "sent") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-foreground">{sentText}</p>
        <Button variant="secondary" onClick={() => switchMode("login")}>Back to log in</Button>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (mode === "signup") {
      const uErr = usernameError(username);
      if (uErr) return setError(uErr);
      if (password !== confirm) return setError("Passwords do not match");
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : "Invalid email or password");
        onDone?.();
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin, data: { username: username.trim(), display_name: username.trim() } },
        });
        if (error) throw error;
        if (data.session) { onDone?.(); return; }
        setSentText(`We sent a confirmation link to ${email.trim()}. Open it to activate your account, then log in.`);
        setMode("sent");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSentText(`If an account exists for ${email.trim()}, a password reset link is on its way.`);
        setMode("sent");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {mode !== "forgot" ? (
        <div className="mb-5 flex items-center justify-center gap-3 font-display text-xl font-bold uppercase" role="tablist" aria-label="Account">
          {(["login", "signup"] as const).map((m, i) => (
            <span key={m} className="flex items-center gap-3">
              {i === 1 && <span className="text-muted-foreground">/</span>}
              <button type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                className={mode === m ? "border-b-2 border-primary pb-1 text-primary" : "pb-1 text-muted-foreground hover:text-foreground"}>
                {m === "login" ? "Log In" : "Register"}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <h2 className="mb-4 text-center font-display text-xl font-bold uppercase text-primary">Reset password</h2>
      )}
      {mode === "signup" && (
        <div className="space-y-1">
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={username} maxLength={20} autoComplete="username" onChange={(e) => setUsername(e.target.value)} required />
          <p className="text-xs text-muted-foreground">3–20 letters, numbers or underscores. Shown on the leaderboard.</p>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {mode !== "forgot" && (
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
      )}
      {mode === "signup" && (
        <div className="space-y-1">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full bg-verdant font-display font-bold uppercase tracking-wider text-primary-foreground hover:bg-verdant/90" disabled={busy}>
        {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}
      </Button>
      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {mode === "forgot" ? (
          <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={() => switchMode("login")}>Back to log in</button>
        ) : <span />}
        {mode === "login" && (
          <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={() => switchMode("forgot")}>Forgot password?</button>
        )}
      </div>
    </form>
  );
}
