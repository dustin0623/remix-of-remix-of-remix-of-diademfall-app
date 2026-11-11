import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummoningDialog, type SummoningPhase } from "./SummoningDialog";
import { SummoningReveal } from "./SummoningReveal";

import { useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { HERO_RARITY_DEFS, HeroRarity } from "@/game/data/HeroRarity";
import { listHeroes } from "@/lib/game/heroes/heroes.functions";
import { mintHeroes } from "@/lib/game/heroes/heroes.functions";
import { mintCost } from "@/lib/game/heroes/mint";
import type { SessionHero } from "@/lib/game/session/types";

import bombImg from "@/assets/mint-bomb.png";

import "@/styles/mint-heroes.css";

const tokenUrl = "/game/items/token.png";
const EMBLEMS: Record<HeroRarity, string> = {
  [HeroRarity.Common]: "/game/emblems/common_emblem.webp",
  [HeroRarity.Uncommon]: "/game/emblems/uncommon_emblem.webp",
  [HeroRarity.Rare]: "/game/emblems/rare_emblem.webp",
  [HeroRarity.Epic]: "/game/emblems/epic_emblem.webp",
  [HeroRarity.Legendary]: "/game/emblems/legendary_emblem.webp",
};

export function MintHeroesContent({ onMinted, onBack, preview }: {
  onMinted?: (heroes: SessionHero[], coins: number) => void;
  onBack?: () => void;
  preview?: { coins: number; mint: (count: number) => Promise<SessionHero[]> };
}) {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const [coins, setCoins] = useState<number | null>(preview?.coins ?? null);
  const [qty, setQty] = useState(1);
  const [phase, setPhase] = useState<SummoningPhase>("confirm");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [minted, setMinted] = useState<SessionHero[]>([]);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);


  const refresh = useCallback(() => {
    if (preview || !player || !token) return;
    listHeroes({ data: { playerId: player.id, token } })
      .then((snap) => setCoins(snap.coins))
      .catch(() => setCoins(null));
  }, [player, token, preview]);
  useEffect(refresh, [refresh]);

  const total = mintCost(qty);
  const mint = async () => {
    if (busy || !canAfford || (!preview && (!player || !token))) return;
    setBusy(true);
    setPhase("summoning");
    setMessage(null);
    setMinted([]);

    setCount(qty);
    setOpen(false);
    try {
      const result = preview
        ? { heroes: await preview.mint(qty), coins: (coins ?? preview.coins) - total }
        : player && token
          ? await mintHeroes({ data: { playerId: player.id, token, count: qty } })
          : null;
      if (!result) throw new Error("Connect your wallet before summoning.");
      setCoins(result.coins);
      setMinted(result.heroes);
      onMinted?.(result.heroes, result.coins);
      setPhase("reveal");
      if (preview) return;
      const store = useGameStore.getState();
      store.addHeroes(result.heroes);
      store.patchSession({ coins: result.coins });
      store.setStats({ coins: result.coins, stage: store.stage, heroesOnMap: store.heroesOnMap });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Summoning failed");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  };

  const rarities = Object.values(HeroRarity);
  const fmtRate = (w: number) => `${w >= 1 ? w : Number(w.toPrecision(3))}%`;
  const canAfford = coins !== null && coins >= total;

  if (phase !== "confirm") {
    return <SummoningReveal phase={phase} quantity={count} heroes={minted} error={message}
      onClose={() => { setPhase("confirm"); setOpen(false); setMinted([]); }} />;
  }

  return (
    <>
      <section className="mh-summoning" aria-label="Hero summoning">
        <div className="mh-odds">
          <h2>Summoning chances</h2>
          <ul>
            {rarities.map((r) => <li key={r} data-rarity={r}>
              <img src={EMBLEMS[r]} alt="" width={32} height={32} />
              <span><strong>{HERO_RARITY_DEFS[r].label}</strong><small>{fmtRate(HERO_RARITY_DEFS[r].weight)}</small></span>
            </li>)}
          </ul>
        </div>
        <div className="mh-ritual">
          <header className="mh-ritual-heading">
            <p>The summoning gate</p>
            <h1>Summon your next hero</h1>
            <span>A new bomber. A new adventure.</span>
            {onBack && <Button type="button" className="mh-back" onClick={onBack}><ArrowLeft /> Back to Heroes</Button>}
          </header>
          <div className={`mh-gate${busy ? " mh-gate-active" : ""}`} aria-hidden="true">
            <img src="/game/hud/summoning-gate.webp" alt="" width={1254} height={1254} />
          </div>
          <div className="mh-summon-dock">
            <div className="mh-summon-summary">
              <span>Per hero <strong><img src={tokenUrl} alt="" />{mintCost(1).toLocaleString()} coins</strong></span>
              <span>Your balance <strong><img src={tokenUrl} alt="" />{coins === null ? "—" : `${coins.toLocaleString()} coins`}</strong></span>
            </div>
            <div className="mh-summon-actions">
              <Button type="button" className="mh-mint mh-summon-button" disabled={busy || !canAfford} onClick={() => { setMessage(null); setMinted([]); setPhase("confirm"); setOpen(true); }}>
                {busy ? <Loader2 className="animate-spin" /> : <img src={bombImg} alt="" />}
                <span>Summon Hero</span>
              </Button>
            </div>
            {coins !== null && !canAfford && <p className="mh-note"><CheckCircle2 />Not enough coins for this summon.</p>}
            {message && <p className="mh-note" role="alert">{message}</p>}
          </div>
        </div>
      </section>
      <SummoningDialog open={open && phase === "confirm"} onOpenChange={setOpen} phase={phase}
        quantity={phase === "confirm" ? qty : count} onQuantityChange={setQty}
        coins={coins} heroes={minted} error={message} onConfirm={() => void mint()} />
    </>
  );
}
