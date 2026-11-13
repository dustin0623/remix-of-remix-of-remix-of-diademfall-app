import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HudIcon } from "@/components/portal/HudIcon";
import { useAuthStore } from "@/features/stores/auth.store";
import { CHESTS } from "@/game/chests";
import type { ChestType } from "@/game/divisions";
import { formatAmount } from "@/lib/economy/currency";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { myChestsQuery } from "@/lib/packs/packs.queries";
import { PackInventory } from "./PackInventory";

export function OtherItems() {
  const userId = useAuthStore((s) => s.user?.id);
  const wallet = useQuery(walletQuery(userId));
  const chests = useQuery(myChestsQuery(userId));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8">
      <section className="panel-ornate p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase text-primary">Currencies</h2>
          <Link to="/wallet" className="play-small-button">
            View Wallet
          </Link>
        </div>
        {wallet.isError ? (
          <div role="alert">
            <p>Couldn't load your balances.</p>
            <button
              type="button"
              className="play-small-button mt-2"
              onClick={() => void wallet.refetch()}
            >
              Try again
            </button>
          </div>
        ) : wallet.data ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(["credits", "coins"] as const).map((currency) => {
              const locked = wallet.data[currency === "credits" ? "lockedCredits" : "lockedCoins"];
              return (
                <li
                  key={currency}
                  className="flex items-center gap-3 rounded border border-border bg-night/60 p-3"
                >
                  <HudIcon
                    name={currency === "credits" ? "credits" : "treasury"}
                    className="size-8"
                  />
                  <div className="min-w-0">
                    <h3 className="capitalize">{currency}</h3>
                    <strong className="break-all font-display text-xl tabular-nums">
                      {formatAmount(wallet.data[currency], currency)}
                    </strong>
                    {Number(locked) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatAmount(locked, currency)} locked
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status">Loading your balances…</p>
        )}
      </section>
      <PackInventory />
      <section className="panel-ornate p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase text-primary">Chests</h2>
          {!!chests.data?.length && (
            <Link to="/ranked" search={{ tab: "rewards" }} className="play-small-button">
              Open Chests
            </Link>
          )}
        </div>
        {chests.isError ? (
          <div role="alert">
            <p>Couldn't load your chests.</p>
            <button
              type="button"
              className="play-small-button mt-2"
              onClick={() => void chests.refetch()}
            >
              Try again
            </button>
          </div>
        ) : !chests.data ? (
          <p role="status">Loading your chests…</p>
        ) : chests.data.length ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {chests.data.map(({ id, balance }) => (
              <li
                key={id}
                className="flex items-center gap-3 rounded border border-border bg-night/60 p-3"
              >
                <HudIcon name="rewards" className="size-8" />
                <div>
                  <h3 className="capitalize">
                    {CHESTS[id as ChestType]?.name ?? id.replace(/_/g, " ")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {balance.toLocaleString()} unopened
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">You have no unopened chests.</p>
        )}
      </section>
    </main>
  );
}
