import { Link, useRouterState } from "@tanstack/react-router";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { WalletBadge } from "@/components/economy/WalletBadge";
import { HudIcon } from "@/components/portal/HudIcon";
import { useAccount } from "@/hooks/use-account";
import { divisionFor } from "@/game/divisions";

export function GameHeader() {
  const { user, account } = useAccount();
  const [menu, setMenu] = useState("");
  const location = useRouterState({ select: (s) => s.location });
  const path = location.pathname;
  const collection = path === "/market" && location.searchStr.includes("collection");
  const items = [
    {
      to: "/ranked",
      label: "Play",
      icon: "play",
      active: path.startsWith("/ranked") || path === "/battle",
    },
    { to: "/shop", label: "Shop", icon: "shop", active: path === "/shop" },
    { to: "/market", label: "Market", icon: "market", active: path === "/market" && !collection },
    { to: "/open", label: "Open", icon: "rewards", active: path === "/open" },
    {
      to: "/market",
      label: "Cards",
      icon: "collection",
      active: collection,
      search: { section: "collection" as const },
    },
    { to: "/codex", label: "Codex", icon: "codex", active: path === "/codex" },
  ] as const;
  return (
    <header className="game-header game-header-v4">
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
        >
          <NavigationMenu.List className="hud-nav-list">
            {items.map((item) => (
              <NavigationMenu.Item key={item.label}>
                <NavigationMenu.Link asChild>
                  <Link
                    to={item.to}
                    search={"search" in item ? item.search : {}}
                    className={`hud-nav-link ${item.active ? "hud-nav-active" : ""}`}
                    aria-current={item.active ? "page" : undefined}
                  >
                    <HudIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
            <NavigationMenu.Item value="realm">
              <NavigationMenu.Trigger
                className={`hud-nav-link hud-play-trigger ${["/leaderboard", "/treasury", "/wallet", "/activity"].includes(path) ? "hud-nav-active" : ""}`}
              >
                <HudIcon name="ladder" />
                <span>
                  Realm <ChevronDown className="size-2.5" />
                </span>
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="hud-play-dropdown">
                {(
                  [
                    ["/leaderboard", "Leaderboard"],
                    ["/treasury", "Treasury"],
                    ["/wallet", "Wallet"],
                    ["/activity", "Activity"],
                  ] as const
                ).map(([to, label]) => (
                  <NavigationMenu.Link asChild key={to}>
                    <Link to={to} onClick={() => setMenu("")}>
                      {label}
                    </Link>
                  </NavigationMenu.Link>
                ))}
              </NavigationMenu.Content>
            </NavigationMenu.Item>
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
                  ? `${divisionFor(account.rating)} · ${account.rating}`
                  : "Your legend starts here"}
              </span>
            </div>
            <LoginDialog triggerClassName="hud-account-trigger" label="Log in" />
          </div>
        </div>
      </div>
    </header>
  );
}
