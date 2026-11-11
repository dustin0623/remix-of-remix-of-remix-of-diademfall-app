import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { SettingsModal } from "@/components/layout/SidebarModals";
import { AccountMenuModal, type AccountAction } from "@/components/layout/AccountMenuModal";
import { clearDeadSession, useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { getPlayerProfile } from "@/lib/game/profile/profile.functions";
import { cosmeticImage } from "@/lib/game/profile/cosmetics";
import { getXrpBalance } from "@/lib/game/wallet/wallet.functions";
import { captureReferralCode } from "@/lib/chains/providers";

import { GameHud, HudProfileBody } from "./GameHud";
export { HudIcon } from "./GameHud";

/** Keeps level, coins and XRP fresh on sign-in and on every page change. */
function useAccountRefresh() {
  const playerId = useAuthStore((s) => s.player?.id);
  const token = useAuthStore((s) => s.token);
  const pathname = useLocation({ select: (l) => l.pathname });
  const [xrp, setXrp] = useState<number | null>(null);
  useEffect(() => captureReferralCode(), []);
  useEffect(() => {
    if (!playerId || !token) return setXrp(null);
    let cancelled = false;
    getPlayerProfile({ data: { playerId, token } })
      .then((p) => {
        if (cancelled) return;
        useAuthStore.getState().setLevel(p.level);
        useAuthStore.getState().setCosmetics({ avatarId: p.avatarId, backgroundId: p.backgroundId });
        // The live Play board publishes its own coin count.
        if (pathname !== "/play") useGameStore.setState({ coins: p.coins });
      })
      .catch((e: unknown) => { clearDeadSession(e); });
    getXrpBalance({ data: { playerId, token } })
      .then((r) => !cancelled && setXrp(r.xrp))
      .catch((e: unknown) => { clearDeadSession(e); });
    return () => {
      cancelled = true;
    };
  }, [playerId, token, pathname]);
  return xrp;
}

function ProfileButton() {
  const avatarId = useAuthStore((s) => s.avatarId);
  const player = useAuthStore((s) => s.player);
  const level = useAuthStore((s) => s.level);
  const stage = useGameStore((s) => s.stage);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"settings" | null>(null);
  const body = (
    <HudProfileBody name={player?.username ?? "Adventurer"} avatarUrl={cosmeticImage(avatarId, "avatar")} stage={player ? stage : undefined}
      level={player ? <><Star fill="currentColor" /> {level ?? 1}</> : "Connect wallet"} />
  );
  if (!player)
    return (
      <ConnectWalletModal>
        <button className="hud-profile" aria-label="Connect your wallet">{body}</button>
      </ConnectWalletModal>
    );
  const onSelect = (action: AccountAction) => {
    if (action === "profile") void navigate({ to: "/profile" });
    else if (action === "withdraw") void navigate({ to: "/wallet", search: { tab: "withdraw" } });
    else if (action === "history") void navigate({ to: "/history", search: { tab: "transaction", range: "30days" } });
    else if (action === "wiki") void navigate({ to: "/wiki" });
    else if (action === "signout") logout();
    else setModal(action);
  };
  return (
    <>
      <AccountMenuModal open={menu} onOpenChange={setMenu} onSelect={onSelect}
        name={player.username} avatarUrl={cosmeticImage(avatarId, "avatar")} level={level ?? 1}
        trigger={<button className="hud-profile" aria-label="Account menu">{body}</button>} />
      <SettingsModal open={modal === "settings"} onOpenChange={(o) => !o && setModal(null)} />
    </>
  );
}

export function GameShell({ children }: { children: ReactNode }) {
  const backgroundId = useAuthStore((s) => s.backgroundId);
  const player = useAuthStore((s) => s.player);
  const coins = useGameStore((s) => s.coins);
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  useAccountRefresh();
  const walletButton = <button className="hud-plus" aria-label={player ? "Open wallet" : "Connect wallet"} onClick={player ? () => void navigate({ to: "/wallet", search: { tab: "deposit" } }) : undefined}><Plus /></button>;
  return (
    <GameHud coins={player ? coins : 0} pathname={pathname} profile={<ProfileButton />} backgroundUrl={cosmeticImage(player ? backgroundId : 200, "background")}
      wallet={player ? walletButton : <ConnectWalletModal>{walletButton}</ConnectWalletModal>}>
      {children}
    </GameHud>
  );
}
