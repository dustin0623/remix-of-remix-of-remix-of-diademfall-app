import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FILTERS, HeroCollectionFilters } from "@/components/game/HeroFilters";
import { filterHeroes, sortCollectionHeroes } from "@/lib/game/heroes/ranking";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { HeroesEmptyState } from "@/components/game/HeroesEmptyState";
import { HeroCollectionCard } from "@/components/game/HeroCollectionCard";
import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { HeroActions } from "@/components/game/HeroActions";
import { Button } from "@/components/ui/button";
import { HeroActionsPopover } from "@/components/game/HeroActionsPopover";
import "@/styles/heroes-collection.css";
import { PageLoader } from "@/components/layout/PageLoader";
import { useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { canDeployEnergy, MAX_ON_MAP } from "@/lib/config/constants/game";
import type { SessionHero } from "@/lib/game/session/types";
import { SellHeroDialog } from "@/components/game/SellHeroDialog";
import { LevelUpDialog } from "@/components/game/LevelUpDialog";
import { RestInHouseDialog } from "@/components/game/RestInHouseDialog";
import { setHeroHouse } from "@/lib/game/houses/houses.functions";
import { cancelHeroListing } from "@/lib/game/heroes/market.functions";
import {
  listHeroes,
  saveHeroesState,
  type HeroesSnapshot,
} from "@/lib/game/heroes/heroes.functions";

export const Route = createFileRoute("/heroes")({
  head: () => ({
    meta: [
      { title: "Heroes — Vexaria" },
      { name: "description", content: "Your bombers, their stats and rarities." },
      { property: "og:title", content: "Heroes — Vexaria" },
      { property: "og:description", content: "Your bombers, their stats and rarities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const [snapshot, setSnapshot] = useState<HeroesSnapshot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selling, setSelling] = useState<SessionHero | null>(null);
  const [housing, setHousing] = useState<SessionHero | null>(null);
  const [leveling, setLeveling] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const dropFromPlay = (id: string) => {
    const store = useGameStore.getState();
    if (store.session)
      store.setSession(
        { ...store.session, heroes: store.session.heroes.filter((h) => h.id !== id) },
        store.syncer,
        store.heroesSyncer,
      );
    store.setRoster(store.roster.filter((h) => h.id !== id));
  };
  const leaveHouse = async (hero: SessionHero) => {
    if (!player || !token) return;
    setActionError(null);
    try {
      const { energy } = await setHeroHouse({
        data: { playerId: player.id, token, heroId: hero.id, houseId: null },
      });
      patchHero(hero.id, {
        houseId: undefined,
        houseRarity: undefined,
        energy,
        recoveryAt: Date.now(),
      });
      useGameStore.getState().setSession(null, null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not leave house");
    }
  };
  const patchHero = (id: string, patch: Partial<SessionHero>) =>
    setSnapshot((c) =>
      c ? { ...c, heroes: c.heroes.map((h) => (h.id === id ? { ...h, ...patch } : h)) } : c,
    );
  const cancelSale = async (hero: SessionHero) => {
    if (!player || !token) return;
    setActionError(null);
    try {
      await cancelHeroListing({ data: { playerId: player.id, token, heroId: hero.id } });
      patchHero(hero.id, { listed: false, marketPrice: undefined });
      // Force Play to reload so the hero is selectable again.
      useGameStore.getState().setSession(null, null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not cancel sale");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadError(false);
    if (!player || !token) return;
    listHeroes({ data: { playerId: player.id, token } })
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [player, token, reloadKey]);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const shown = useMemo(
    () => (snapshot ? sortCollectionHeroes(filterHeroes(snapshot.heroes, filters), "heroes", filters.sort) : []),
    [snapshot, filters],
  );
  const selected = snapshot?.heroes.find((hero) => hero.id === selectedId);
  const onMapCount = snapshot?.heroes.filter((hero) => hero.onMap).length ?? 0;
  const toggleHero = async (hero: SessionHero) => {
    if (!player || !token || saving) return;
    const energy = hero.energy ?? hero.maxEnergy;
    if (!hero.onMap && (!canDeployEnergy(energy, hero.maxEnergy) || onMapCount >= MAX_ON_MAP))
      return;
    const update = {
      id: hero.id,
      energy,
      onMap: !hero.onMap,
      recoveryAt: hero.onMap ? Date.now() : (hero.recoveryAt ?? Date.now()),
    };
    setSaving(true);
    setActionError(null);
    try {
      const session = useGameStore.getState().session;
      const sessionToken = session?.playerId === player.id ? session.sessionToken : undefined;
      await saveHeroesState({
        data: {
          playerId: player.id,
          token,
          heroes: [update],
          ...(sessionToken ? { sessionToken } : {}),
        },
      });
      setSnapshot((current) =>
        current
          ? {
              ...current,
              heroes: current.heroes.map((h) => (h.id === hero.id ? { ...h, ...update } : h)),
            }
          : current,
      );
      const store = useGameStore.getState();
      if (store.session?.playerId === player.id) {
        store.patchSessionHeroes([update]);
        store.setRoster(store.roster.map((h) => (h.id === hero.id ? { ...h, ...update } : h)));
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not save hero state. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {player && token && !snapshot && !loadError ? <PageLoader label="Loading heroes…" /> :
      <section className="hc-page panel-page" aria-label="Heroes">
        {actionError && (
          <p role="alert" className="hc-error">
            {actionError}
          </p>
        )}
          <div className="hc-layout">
            <div className="hc-collection">
              <div className="hc-toolbar panel-head">
                <div className="hc-filters">
                  <HeroCollectionFilters value={filters} onChange={setFilters} heroes={snapshot?.heroes ?? []} />
                </div>
              </div>
              <div className="hc-results panel-scroll" role="region" aria-label="Hero collection" tabIndex={0}>
              {!player || !token ? (
                <div className="hc-empty">
                  <Sparkles />
                  <p>Connect your wallet to view and manage your heroes.</p>
                  <ConnectWalletModal>
                    <Button>Connect wallet</Button>
                  </ConnectWalletModal>
                </div>
              ) : loadError ? (
                <div className="hc-empty" role="alert">
                  <p>Couldn&apos;t load your heroes. Check your connection and try again.</p>
                  <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                    Try again
                  </Button>
                </div>
              ) : !snapshot ? (
                <div className="hc-empty" role="status" aria-label="Loading heroes">
                  <Loader2 className="animate-spin" />
                </div>
              ) : snapshot.heroes.length === 0 ? (
                <HeroesEmptyState onShop={() => void navigate({ to: "/shop" })} />
              ) : shown.length === 0 ? (
                <div className="hc-empty">
                  <p>No heroes match these filters.</p>
                  <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="hc-grid">
                  {shown.map((hero) => (
                    <HeroActionsPopover key={hero.id} hero={hero} open={selectedId === hero.id}
                      onOpenChange={(open) => setSelectedId(open ? hero.id : null)} restoreFocus={!leveling && !selling && !housing}
                      actions={<HeroActions hero={hero} onMapCount={onMapCount} disabled={saving} layout="popover"
                        onToggle={() => toggleHero(hero)}
                        onLevelUp={() => { setSelectedId(null); setLeveling(hero.id); }}
                        onSell={() => { setSelectedId(null); setSelling(hero); }}
                        onCancelSale={() => cancelSale(hero)}
                        onRestInHouse={() => { setSelectedId(null); setHousing(hero); }}
                        onLeaveHouse={() => leaveHouse(hero)} />}>
                      <HeroCollectionCard hero={hero} selected={selectedId === hero.id} popoverOpen={selectedId === hero.id}
                        onSelect={() => setSelectedId((id) => id === hero.id ? null : hero.id)} />
                    </HeroActionsPopover>
                  ))}
                </div>
              )}
              </div>
            </div>

          </div>
      </section>}
      {player && token && snapshot && (
        <LevelUpDialog
          hero={snapshot.heroes.find((h) => h.id === leveling) ?? null}
          playerId={player.id}
          token={token}
          coins={snapshot.coins}
          onClose={() => setLeveling(null)}
          onLeveled={(id, patch, coins) => {
            setSnapshot((c) =>
              c
                ? {
                    ...c,
                    coins,
                    heroes: c.heroes.map((h) => (h.id === id ? { ...h, ...patch } : h)),
                  }
                : c,
            );
            useGameStore.setState({ coins });
            useGameStore.getState().setSession(null, null);
          }}
        />
      )}
      {player && token && snapshot && (
        <RestInHouseDialog
          hero={housing}
          heroes={snapshot.heroes}
          playerId={player.id}
          token={token}
          onClose={() => setHousing(null)}
          onMoved={(id, house, energy) => {
            patchHero(id, {
              houseId: house.id,
              houseRarity: house.rarity,
              energy,
              recoveryAt: Date.now(),
              onMap: false,
            });
            dropFromPlay(id);
          }}
        />
      )}
      {player && token && (
        <SellHeroDialog
          hero={selling}
          playerId={player.id}
          token={token}
          onClose={() => setSelling(null)}
          onListed={(id, price) => {
            patchHero(id, { listed: true, marketPrice: price, onMap: false });
            // Drop it from the cached play session so the game drawer no longer offers it.
            const store = useGameStore.getState();
            if (store.session)
              store.setSession(
                { ...store.session, heroes: store.session.heroes.filter((h) => h.id !== id) },
                store.syncer,
                store.heroesSyncer,
              );
            store.setRoster(store.roster.filter((h) => h.id !== id));
          }}
        />
      )}
    </>
  );
}
