import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageLoader } from "@/components/layout/PageLoader";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileContent } from "@/components/game/ProfileContent";
import { HouseRegistration } from "@/components/game/HouseRegistration";
import { useAuthStore } from "@/features/stores/auth.store";
import { equipCosmetic, getPlayerProfile, updateUsername, type PlayerProfile } from "@/lib/game/profile/profile.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Vexaria" },
      { name: "description", content: "Your level, experience, chests broken and gold claimed." },
      { property: "og:title", content: "Profile — Vexaria" },
      { property: "og:description", content: "Your level, experience, chests broken and gold claimed." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setLevel = useAuthStore((s) => s.setLevel);
  const setPlayer = useAuthStore((s) => s.setPlayer);

  useEffect(() => {
    if (!player || !token) return;
    let cancelled = false;
    getPlayerProfile({ data: { playerId: player.id, token } })
      .then((p) => { if (!cancelled) { setProfile(p); setLevel(p.level); useAuthStore.getState().setCosmetics({ avatarId: p.avatarId, backgroundId: p.backgroundId }); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load profile"); });
    return () => { cancelled = true; };
  }, [player?.id, token, setLevel]);

  if (error || !profile) return <section className="pf-page" aria-label="Player profile"><header className="pf-section-heading"><h1>Profile</h1></header>{error ? <p role="alert">{error}</p> : <PageLoader label="Loading profile…" />}</section>;

  return <ProfileContent profile={profile}
    rename={async (draft) => {
      if (!player || !token) return;
      const { username } = await updateUsername({ data: { playerId: player.id, token, username: draft } });
      setProfile((p) => p && { ...p, username });
      setPlayer({ ...player, username });
    }}
    onEquip={async (kind, templateId) => {
      if (!player || !token) return;
      await equipCosmetic({ data: { playerId: player.id, token, kind, templateId } });
      const cosmetics = { avatarId: profile.avatarId, backgroundId: profile.backgroundId, [`${kind}Id`]: templateId };
      setProfile((p) => p && { ...p, ...cosmetics });
      useAuthStore.getState().setCosmetics(cosmetics);
    }}
    houseRegistration={player && token ? <HouseRegistration playerId={player.id} token={token} /> : null}
  />;
}
