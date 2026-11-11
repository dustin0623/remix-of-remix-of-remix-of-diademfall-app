import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Diademfall" },
      { name: "description", content: "Choose a new password for your Diademfall account." },
      { property: "og:title", content: "Reset password — Diademfall" },
      { property: "og:description", content: "Choose a new password for your Diademfall account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); });
    void supabase.auth.getSession().then(({ data: s }) => { if (s.session && isRecovery) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen">
      <GameHeader />
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-6 font-display text-3xl font-black text-gold">New password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email to choose a new password.</p>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="space-y-1">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>Save password</Button>
          </form>
        )}
      </main>
    </div>
  );
}
