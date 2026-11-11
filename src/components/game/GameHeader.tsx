import { Link, useRouterState } from "@tanstack/react-router";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { useState } from "react";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { WalletBadge } from "@/components/economy/WalletBadge";
import { HudIcon } from "@/components/portal/HudIcon";
import { ChallengeDialog } from "@/components/portal/ChallengeDialog";
import { useAccount } from "@/hooks/use-account";
import { leagueFor } from "@/game/profile";

export function GameHeader() {
  const { user, account } = useAccount();
  const [menu, setMenu] = useState("");
  const [challenge, setChallenge] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const playing = path === "/battle" || path.startsWith("/ranked");
  const inMarket = path === "/shop" || path === "/market";
  const items = [
    { to: "/open", label: "Open", icon: "rewards", show: !!user },
    { to: "/leaderboard", label: "Ladder", icon: "ladder", show: !!user },
    { to: "/treasury", label: "Treasury", icon: "treasury", show: true },
    { to: "/codex", label: "Codex", icon: "codex", show: true },
  ] as const;
  return (
    <>
      <header className="game-header">
        <div className="game-header-main">
          <Link to="/" className="hud-brand" aria-label="Diademfall home">
            <img src="/assets/HUD/crown-logo-v1.png" alt="Diademfall" width={1280} height={1280} />
          </Link>
          <NavigationMenu.Root
            className="hud-navigation"
            aria-label="Main navigation"
            value={menu}
            onValueChange={setMenu}
            delayDuration={80}
            skipDelayDuration={250}
          >
            <NavigationMenu.List className="hud-nav-list">
              <NavigationMenu.Item value="play" className="hud-play-item">
                <NavigationMenu.Trigger
                  className={`hud-nav-link hud-play-trigger ${playing ? "hud-nav-active" : ""}`}
                >
                  <HudIcon name="play" />
                  <span>Play</span>
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="hud-play-dropdown">
                  <NavigationMenu.Link asChild>
                    <Link to="/ranked" onClick={() => setMenu("")}>
                      Ranked
                    </Link>
                  </NavigationMenu.Link>
                  <NavigationMenu.Link asChild>
                    <Link to="/battle" onClick={() => setMenu("")}>
                      Practice
                    </Link>
                  </NavigationMenu.Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu("");
                      setChallenge(true);
                    }}
                  >
                    Challenge <span>Soon</span>
                  </button>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
              {user && (
                <NavigationMenu.Item value="market">
                  <NavigationMenu.Trigger
                    className={`hud-nav-link hud-play-trigger ${inMarket ? "hud-nav-active" : ""}`}
                  >
                    <HudIcon name="market" />
                    <span>Market</span>
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content className="hud-play-dropdown">
                    <NavigationMenu.Link asChild>
                      <Link to="/shop" onClick={() => setMenu("")}>
                        Packs
                      </Link>
                    </NavigationMenu.Link>
                    <NavigationMenu.Link asChild>
                      <Link to="/market" onClick={() => setMenu("")}>
                        Cards
                      </Link>
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              )}
              {items
                .filter((i) => i.show)
                .map(({ to, label, icon }) => (
                  <NavigationMenu.Item key={to}>
                    <NavigationMenu.Link asChild>
                      <Link
                        to={to}
                        className="hud-nav-link"
                        activeProps={{ className: "hud-nav-active" }}
                      >
                        <HudIcon name={icon} />
                        <span>{label}</span>
                      </Link>
                    </NavigationMenu.Link>
                  </NavigationMenu.Item>
                ))}
            </NavigationMenu.List>
          </NavigationMenu.Root>
          <div className="hud-account-area">
            <WalletBadge />
            <div className="hud-profile">
              <HudIcon name="ranked" className="hud-profile-emblem" />
              <div className="hud-profile-name">
                <strong>{account?.displayName ?? (user ? "Adventurer" : "Log In")}</strong>
                <span>
                  {account
                    ? `${leagueFor(account.rating)} · ${account.rating}`
                    : "Begin your legend"}
                </span>
              </div>
              <LoginDialog triggerClassName="hud-account-trigger" label="Log in" />
            </div>
          </div>
        </div>
      </header>
      <ChallengeDialog open={challenge} onOpenChange={setChallenge} />
    </>
  );
}
