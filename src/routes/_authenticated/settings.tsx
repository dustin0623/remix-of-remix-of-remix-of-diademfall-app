import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/hooks/use-account";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Diademfall" },
      { name: "description", content: "Change your Diademfall display name and account password." },
      { property: "og:title", content: "Account Settings — Diademfall" },
      { property: "og:description", content: "Manage your Diademfall display name and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, account } = useAccount();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (account) setDisplayName(account.displayName);
  }, [account]);

  const saveName = async () => {
    const name = displayName.trim();
    if (!user) return;
    if (name.length < 3 || name.length > 24) { toast.error("Display name must be 3–24 characters."); return; }
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setSavingName(false);
    if (error) { toast.error("Couldn't save your display name. Try again."); return; }
    await queryClient.invalidateQueries({ queryKey: ["account", user.id] });
    toast.success("Display name updated.");
  };

  const savePassword = async () => {
    if (next.length < 8) { toast.error("New password must be at least 8 characters."); return; }
    if (next !== confirm) { toast.error("New passwords do not match."); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
    setSavingPw(false);
    if (error) { toast.error(error.message || "Couldn't change your password."); return; }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password changed.");
  };

  return (
    <div className="portal-page packs-purchase-page">
      <GameHeader />
      <main className="packs-store-main">
        <div className="commerce-intro">
          <p className="portal-eyebrow">Account</p>
          <h1 className="title-portal">Settings</h1>
        </div>

        <section className="panel-ornate space-y-4 p-6">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input id="display-name" value={displayName} maxLength={24} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={account?.username ?? ""} disabled />
              <p className="text-xs text-muted-foreground">Your username can't be changed.</p>
            </div>
          </div>
          <Button onClick={() => void saveName()} disabled={savingName || !account}>
            {savingName && <Loader2 className="size-4 animate-spin" />} Save display name
          </Button>
        </section>

        <section className="panel-ornate space-y-4 p-6">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Password</h2>
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => void savePassword()} disabled={savingPw || !current || !next}>
            {savingPw && <Loader2 className="size-4 animate-spin" />} Change password
          </Button>
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}
