import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { GameHeader } from "@/components/game/GameHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { HudIcon } from "@/components/portal/HudIcon";
import { divisionFor } from "@/game/divisions";
import { useAccount } from "@/hooks/use-account";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — Diademfall" },
      { name: "description", content: "Your Diademfall name, ranked division, rating, season record and card collection at a glance." },
      { property: "og:title", content: "Your Profile — Diademfall" },
      { property: "og:description", content: "Ranked division, rating, record and collection for your Diademfall account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, account, loading } = useAccount();

  return (
    <div className="portal-page packs-purchase-page">
      <GameHeader />
      <main className="packs-store-main">
        <div className="commerce-intro">
          <p className="portal-eyebrow">Account</p>
          <h1 className="title-portal">Your Profile</h1>
        </div>

        {!account ? (
          <div className="panel-ornate p-10 text-center">
            {loading ? <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Couldn't load your profile. Refresh to try again.</p>}
          </div>
        ) : (
          <>
            <section className="panel-ornate flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
              <HudIcon name="ranked" className="size-20" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-3xl font-black text-foreground">{account.displayName}</h2>
                <p className="text-sm text-muted-foreground">@{account.username} · {user?.email}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary">
                  {divisionFor(account.rating)} · Account level {account.accountLevel}
                </p>
              </div>
              <Link to="/settings" className="play-small-button">
                Edit profile <ArrowRight className="size-3" />
              </Link>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["Rating", account.rating],
                  ["Wins", account.wins],
                  ["Losses", account.losses],
                  ["Draws", account.draws],
                  ["Win streak", account.winStreak],
                  ["Cards", account.cardsOwned],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="panel-ornate p-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="mt-1 font-display text-2xl font-black tabular-nums text-primary">{value}</div>
                </div>
              ))}
            </section>

            {account.season && (
              <p className="text-center text-xs text-muted-foreground">
                Ranked season {account.season.number} · ends {new Date(account.season.endsAt).toLocaleDateString()}
              </p>
            )}
          </>
        )}
      </main>
      <PortalFooter />
    </div>
  );
}
