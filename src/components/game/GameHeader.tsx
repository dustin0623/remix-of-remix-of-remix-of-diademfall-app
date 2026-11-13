import { Link, useRouterState } from "@tanstack/react-router";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { useState, type ReactNode } from "react";
import { ProfileMenu } from "@/components/game/ProfileMenu";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { WalletBadge } from "@/components/economy/WalletBadge";
import { HudIcon } from "@/components/portal/HudIcon";
import { ChallengeDialog } from "@/components/portal/ChallengeDialog";
import { useAccount } from "@/hooks/use-account";
import { divisionFor } from "@/game/divisions";

export function GameHeader() {
  const { user, account } = useAccount();
  const [menu, setMenu] = useState("");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const location = useRouterState({ select: (s) => s.location });
  const path = location.pathname;
  const market = path === "/market";
  const items = path === "/items";
  const packs = market && location.search.section === "packs";
  const others = items && location.search.section === "others";
  const ranked = path.startsWith("/ranked");
  const practice = path === "/battle";
  const codex = path === "/codex";
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
            <HeaderMenu label="War" icon="war" active={ranked || practice}>
              <NavigationMenu.Link asChild active={ranked}>
                <Link to="/ranked">Ranked</Link>
              </NavigationMenu.Link>
              <NavigationMenu.Link asChild active={practice}>
                <Link to="/battle">Practice</Link>
              </NavigationMenu.Link>
              <NavigationMenu.Link asChild>
                <button type="button" onClick={() => setChallengeOpen(true)}>
                  Challenge
                </button>
              </NavigationMenu.Link>
            </HeaderMenu>
            <HeaderMenu label="Market" icon="market" active={market}>
              <NavigationMenu.Link asChild active={packs}>
                <Link to="/market" search={{ section: "packs" }}>
                  Packs
                </Link>
              </NavigationMenu.Link>
              <NavigationMenu.Link asChild active={market && !packs}>
                <Link to="/market" search={{ section: "buy" }}>
                  Cards
                </Link>
              </NavigationMenu.Link>
            </HeaderMenu>
            <HeaderMenu label="Items" icon="items" active={items}>
              <NavigationMenu.Link asChild active={items && !others}>
                <Link to="/items" search={{ section: "cards" }}>
                  Cards
                </Link>
              </NavigationMenu.Link>
              <NavigationMenu.Link asChild active={others}>
                <Link to="/items" search={{ section: "others" }}>
                  Others
                </Link>
              </NavigationMenu.Link>
            </HeaderMenu>
            <NavigationMenu.Item>
              <NavigationMenu.Link asChild active={codex}>
                <Link to="/codex" className={`hud-nav-link ${codex ? "hud-nav-active" : ""}`}>
                  <NavIcon icon="codex" />
                  <span>Codex</span>
                </Link>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
        <div className="hud-account-area">
          <WalletBadge />
          {user ? (
            <ProfileMenu
              name={account?.displayName ?? "Adventurer"}
              detail={
                account
                  ? `${divisionFor(account.rating)} · ${account.rating}`
                  : "Your legend starts here"
              }
            />
          ) : (
            <div className="hud-profile">
              <HudIcon name="ranked" className="hud-profile-emblem" />
              <div className="hud-profile-name">
                <strong>Log In</strong>
                <span>Your legend starts here</span>
              </div>
              <LoginDialog triggerClassName="hud-account-trigger" label="Log in" />
            </div>
          )}
        </div>
      </div>
      <ChallengeDialog open={challengeOpen} onOpenChange={setChallengeOpen} />
    </header>
  );
}

type NavIconName = "war" | "market" | "items" | "codex";

function NavIcon({ icon }: { icon: NavIconName }) {
  return (
    <img
      className="hud-nav-icon"
      src={`/assets/HUD/nav-icons/${icon}.png`}
      width={128}
      height={128}
      alt=""
    />
  );
}

function HeaderMenu({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: NavIconName;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <NavigationMenu.Item value={label}>
      <NavigationMenu.Trigger className={`hud-nav-link ${active ? "hud-nav-active" : ""}`}>
        <NavIcon icon={icon} />
        <span>{label}</span>
      </NavigationMenu.Trigger>
      <NavigationMenu.Content className="hud-play-dropdown hud-section-dropdown" aria-label={label}>
        {children}
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
}
