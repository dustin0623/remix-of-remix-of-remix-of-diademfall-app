import { Link } from "@tanstack/react-router";
import { BookOpen, Crown, Home, Landmark, Store, ShoppingBag, Swords, Trophy } from "lucide-react";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { WalletBadge } from "@/components/economy/WalletBadge";
import { useAccount } from "@/hooks/use-account";
import { leagueFor } from "@/game/profile";
import logo from "@/assets/portal/logo.png";

export function GameHeader() {
  const { user, account } = useAccount();
  const items = [
    { to: "/", label: "Home", icon: Home, exact: true, show: true },
    { to: "/battle", label: "Practice", icon: Swords, show: true },
    { to: "/ranked", label: "Ranked", icon: Trophy, show: !!user },
    { to: "/leaderboard", label: "Ladder", icon: Crown, show: !!user },
    { to: "/shop", label: "Shop", icon: ShoppingBag, show: !!user },
    { to: "/market", label: "Market", icon: Store, show: !!user },
    { to: "/treasury", label: "Treasury", icon: Landmark, show: true },
    { to: "/codex", label: "Codex", icon: BookOpen, show: true },
  ] as const;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-night/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-1.5">
        <Link to="/" className="shrink-0" aria-label="Diademfall home">
          <img src={logo} alt="Diademfall" width={900} height={450} className="h-11 w-auto" />
        </Link>
        <nav className="flex items-center">
          {items.filter((i) => i.show).map(({ to, label, icon: Icon, ...i }) => (
            <Link key={to} to={to} activeOptions={{ exact: "exact" in i }}
              className="group flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition hover:text-primary"
              activeProps={{ className: "text-primary" }}>
              <Icon className="h-5 w-5 transition group-hover:-translate-y-0.5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {account && (
            <div className="hidden text-right text-xs sm:block">
              <div className="font-display font-bold text-primary">{account.displayName} · {leagueFor(account.rating)}</div>
              <div className="text-muted-foreground">Rating {account.rating} · {account.wins}W {account.losses}L</div>
            </div>
          )}
          <WalletBadge />
          <LoginDialog triggerClassName="rounded-md bg-ember px-6 py-2 font-display text-sm font-black uppercase italic tracking-wider text-primary-foreground shadow-glow transition hover:brightness-110" label="Log In" />
        </div>
      </div>
    </header>
  );
}
