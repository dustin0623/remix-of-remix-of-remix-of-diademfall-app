import type { LucideIcon } from "lucide-react";
import { Users, Gamepad2, Home, ShoppingBag, Store, Trophy, FlaskConical } from "lucide-react";

export interface NavItem {
  to: "/play" | "/heroes" | "/house" | "/shop" | "/fusion" | "/marketplace" | "/leaderboard" | "/profile" | "/wiki";
  label: string;
  icon: LucideIcon;
}

/** Paths anyone can open without signing in. Everything else needs a wallet session. */
export const PUBLIC_PAGE_PATHS = ["/", "/wiki", "/test-ui"];

export const NAV_ITEMS: NavItem[] = [
  { to: "/play", label: "Play", icon: Gamepad2 },
  { to: "/heroes", label: "Heroes", icon: Users },
  { to: "/house", label: "House", icon: Home },
  { to: "/shop", label: "Shop", icon: Store },
  { to: "/fusion", label: "Fusion", icon: FlaskConical },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
];
