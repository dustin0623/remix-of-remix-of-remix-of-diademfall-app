import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Coins } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HudIcon } from "./HudIcon";
import { cosmeticImage } from "@/lib/game/profile/cosmetics";
import "@/styles/game-header.css";

interface NavDestination { to: string; label: string; icon: number }
interface NavGroup { label: string; icon: number; children: readonly NavDestination[] }
const NAV: readonly (NavDestination | NavGroup)[] = [
  { label: "Play", icon: 2, children: [
    { to: "/play", label: "Play", icon: 2 },
    { to: "/house", label: "House", icon: 1 },
  ] },
  { label: "Heroes", icon: 0, children: [
    { to: "/heroes", label: "Heroes", icon: 0 },
    { to: "/shop", label: "Shop", icon: 6 },
    { to: "/fusion", label: "Fusion", icon: 3 },
  ] },
  { to: "/marketplace", label: "Market", icon: 4 },
  { to: "/leaderboard", label: "Leaderboard", icon: 5 },
] as const;

/** Identity only; currency and its wallet action belong to the header. */
export function HudProfileBody({ name, level, avatarUrl, stage }: {
  name: string; level: ReactNode; avatarUrl?: string | null; stage?: number | undefined;
}) {
  return <>
    <span className="hud-avatar"><img src={avatarUrl || cosmeticImage(undefined, "avatar")} alt="" /></span>
    <span className="hud-player-info">
      <span className="hud-player-row">
        <strong className="hud-player-name">{name}</strong>
        <span className="hud-player-star">{level}</span>
      </span>
      {stage != null && <span className="hud-player-stage">Stage {stage}</span>}
    </span>
  </>;
}

/** Shared by the live shell and the offline Test UI, independently of page content. */
export function GameHeader({ profile, wallet, coins = 0, pathname, onNavigate, available }: {
  profile: ReactNode; wallet: ReactNode; coins?: number; pathname: string;
  onNavigate?: ((path: string) => void) | undefined; available?: readonly string[] | undefined;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = useRef(false);
  const cancelClose = () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    closeTimer.current = null;
    hoverTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    if (openedByHover.current) closeTimer.current = setTimeout(() => setOpenGroup(null), 160);
  };
  useEffect(() => {
    setOpenGroup(null);
    return () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    };
  }, [pathname]);
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const isUnavailable = (to: string) => !!onNavigate && !!available && !available.includes(to);

  return <header className="hud-header hud-topbar">
    <span className="hud-topbar-brand" aria-label="Vexaria"><HudIcon index={7} /></span>
    <nav className="hud-topbar-nav" aria-label="Main navigation">
      {NAV.map((item) => {
        const grouped = "children" in item;
        const active = grouped ? item.children.some((child) => isActive(child.to)) : isActive(item.to);
        const className = `hud-topbar-link${active ? " hud-topbar-active" : ""}`;
        const leaderboard = !grouped && item.to === "/leaderboard";
        const content = <><HudIcon index={item.icon} /><span className={`hud-topbar-label${leaderboard ? " hud-topbar-label-full" : ""}`}>{item.label}</span>{leaderboard && <span className="hud-topbar-label hud-topbar-label-short" aria-hidden="true">Ranks</span>}</>;
        if (grouped) return (
          <DropdownMenu key={item.label} modal={false} open={openGroup === item.label}
            onOpenChange={(open) => { cancelClose(); openedByHover.current = false; setOpenGroup(open ? item.label : null); }}>
            <DropdownMenuTrigger asChild>
              <button type="button" className={className} aria-label={item.label}
                disabled={item.children.every((child) => isUnavailable(child.to))}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") { cancelClose(); if (openGroup !== item.label) hoverTimer.current = setTimeout(() => { openedByHover.current = true; setOpenGroup(item.label); }, 100); } }}
                onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}>
                {content}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="hud-nav-dropdown" align="start" sideOffset={6} collisionPadding={12}
              aria-label={`${item.label} destinations`} onPointerEnter={cancelClose}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}>
              {item.children.map((child) => {
                const current = isActive(child.to);
                const childContent = <><HudIcon index={child.icon} /><span>{child.label}</span>{current && <Check className="hud-nav-current" aria-hidden="true" />}</>;
                const childProps = { className: "hud-nav-dropdown-item", "aria-current": current ? "page" as const : undefined };
                return onNavigate ? (
                  <DropdownMenuItem key={child.to} {...childProps} disabled={isUnavailable(child.to)} onSelect={() => onNavigate(child.to)}>
                    {childContent}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={child.to} asChild>
                    <Link to={child.to} {...childProps}>{childContent}</Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
        return onNavigate ? (
          <button type="button" key={item.to} className={className} aria-label={item.label} aria-current={active ? "page" : undefined}
            disabled={isUnavailable(item.to)} onClick={() => onNavigate(item.to)}>{content}</button>
        ) : (
          <Link key={item.to} to={item.to} className={className} aria-label={item.label} aria-current={active ? "page" : undefined}>{content}</Link>
        );
      })}
    </nav>
    <div className="hud-header-currency" role="group" aria-label="Gold balance">
      <span className="hud-currency-value" title={`${Math.floor(coins).toLocaleString("en-US")} gold`}>
        <span className="hud-coin-mini" aria-hidden="true"><Coins /></span>
        <span className="sr-only">Gold: </span><span>{Math.floor(coins).toLocaleString("en-US")}</span>
      </span>
      {wallet}
    </div>
    <div className="hud-account-group">{profile}</div>
  </header>;
}
