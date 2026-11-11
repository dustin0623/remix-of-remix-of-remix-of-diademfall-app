import { useEffect, type ReactNode } from "react";
import { PageLoader, PageFade, RouteProgress } from "./PageLoader";
import { useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { ConnectGate } from "@/components/auth/ConnectGate";
import { useAuthStore } from "@/features/stores/auth.store";
import { useHydrated } from "@/hooks/use-hydrated";
import { GameShell } from "./GameShell";
import { GamePanel } from "@/components/ui/GamePanel";
import { PUBLIC_PAGE_PATHS } from "./nav";
import "@/styles/heroes-collection.css";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation({ select: (l) => l.pathname });
  // Layout follows the route actually rendered in <Outlet />, not the pending URL,
  // so the previous page never shows inside the next page's shell mid-navigation.
  const rendered = useRouterState({ select: (s) => s.matches.at(-1)?.pathname });
  const pathname = rendered ?? location;
  const hydrated = useHydrated();
  const player = useAuthStore((s) => s.player);
  const isPublic = PUBLIC_PAGE_PATHS.includes(pathname);
  const navigate = useNavigate();
  const blocked = hydrated && !player && !isPublic;

  // Signed-out visitors may only see the landing page and the wiki.
  useEffect(() => {
    if (blocked) navigate({ to: "/", replace: true });
  }, [blocked, navigate]);

  // Public reading pages and the UI test bench own their layout independently of the game.
  if (pathname === "/" || pathname === "/wiki" || pathname === "/test-ui") return <>{children}</>;

  // Play and House render straight onto the HUD.
  if (pathname === "/play" || pathname === "/house") {
    if (!hydrated || !player) {
      return (
        <div className="grid min-h-screen place-items-center"><PageLoader /></div>
      );
    }
    return <GameShell><RouteProgress /><PageFade id={pathname}>{children}</PageFade></GameShell>;
  }

  if (pathname === "/heroes" || pathname === "/marketplace" || pathname === "/shop" || pathname === "/fusion" || pathname === "/leaderboard" || pathname === "/profile" || pathname === "/wallet" || pathname === "/history") {
    return <GameShell>
      <RouteProgress />
      <div className={pathname === "/shop" ? "hud-summoning" : pathname === "/fusion" ? "hud-fusion" : pathname === "/leaderboard" ? "hud-rankings" : pathname === "/profile" ? "hud-account-page" : pathname === "/wallet" ? "hud-wallet-page" : pathname === "/history" ? "hud-history-page" : "hud-collection hc-shell"}>
        {!hydrated ? (
          <PageLoader />
        ) : player ? <PageFade id={pathname}>{children}</PageFade> : <ConnectGate />}
      </div>
    </GameShell>;
  }

  return (
    <GameShell>
      <GamePanel className="hud-content hc-shell">
        {!hydrated ? (
<PageLoader />
        ) : isPublic || player ? (
          <PageFade id={pathname}>{children}</PageFade>
        ) : (
          <ConnectGate />
        )}
      </GamePanel>
    </GameShell>
  );
}
