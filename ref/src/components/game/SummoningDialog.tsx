import { useEffect, useState, type CSSProperties } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HeroArtwork } from "./HeroArtwork";
import { HERO_STATS, HeroStatIcon } from "./HeroStatIcon";
import { HERO_RARITY_DEFS, type HeroRarity } from "@/game/data/HeroRarity";
import { MAX_MINT_PER_TX, mintCost } from "@/lib/game/heroes/mint";
import type { SessionHero } from "@/lib/game/session/types";
import "@/styles/summoning-dialog.css";

export type SummoningPhase = "confirm" | "summoning" | "reveal" | "error";

export function SummoningDialog({ open, onOpenChange, phase, quantity, onQuantityChange, coins, heroes, error, onConfirm }: {
  open: boolean; onOpenChange: (open: boolean) => void; phase: SummoningPhase;
  quantity: number; onQuantityChange: (quantity: number) => void; coins: number | null;
  heroes: SessionHero[]; error: string | null; onConfirm: () => void;
}) {
  const [revealed, setRevealed] = useState<string[]>([]);
  useEffect(() => { setRevealed([]); }, [heroes]);
  const pending = phase === "summoning";
  const complete = heroes.length > 0 && revealed.length === heroes.length;
  const total = mintCost(quantity);
  const title = phase === "confirm" ? "How many heroes?" : pending ? "The gate is awakening" : phase === "error" ? "Summoning interrupted" : complete ? "Meet your new crew" : "Your heroes are waiting";
  return <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
    <DialogContent className={`sr-modal sr-${phase}`} scrollBody={false} data-pending={pending}
      onEscapeKeyDown={(event) => pending && event.preventDefault()}
      onInteractOutside={(event) => (pending || phase === "reveal") && event.preventDefault()}>
      <div className="sr-scroll">
        <header className="sr-header">
          <span className="sr-eyebrow">Vexaria · Summoning</span>
          <DialogTitle className="sr-title">{title}</DialogTitle>
          <DialogDescription className="sr-description">
            {phase === "confirm" ? "Choose your crew size and confirm the coin cost." : pending ? "Confirming your summon. Keep this window open." : phase === "error" ? error : complete ? `${heroes.length} hero${heroes.length === 1 ? " has" : "es have"} joined your collection.` : "Hover or focus a card for a rarity hint. Select it to reveal your hero."}
          </DialogDescription>
        </header>

        {phase === "confirm" && <div className="sr-confirm-body">
          <img className="sr-confirm-gate" src="/game/hud/summoning-gate.webp" alt="" />
          <div className="sr-quantity" role="group" aria-label="Summon quantity">
            <Button variant="ghost" aria-label="Summon fewer heroes" disabled={quantity <= 1} onClick={() => onQuantityChange(quantity - 1)}><Minus /></Button>
            <strong aria-live="polite">{quantity}</strong>
            <Button variant="ghost" aria-label="Summon more heroes" disabled={quantity >= MAX_MINT_PER_TX} onClick={() => onQuantityChange(quantity + 1)}><Plus /></Button>
          </div>
          <dl className="sr-quote"><div><dt>Total cost</dt><dd>{total.toLocaleString()} coins</dd></div><div><dt>Balance after</dt><dd>{coins === null ? "—" : `${(coins - total).toLocaleString()} coins`}</dd></div></dl>
          <div className="sr-actions"><Button variant="ghost" className="sr-secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button className="mh-mint" disabled={coins === null || coins < total} onClick={onConfirm}>Summon {quantity} Hero{quantity === 1 ? "" : "es"}</Button></div>
          {coins !== null && coins < total && <p className="sr-description" role="status">Not enough coins. Choose fewer heroes.</p>}
        </div>}

        {pending && <div className="sr-pending" role="status" aria-live="polite"><img src="/game/hud/summoning-gate.webp" alt="" /><span><Loader2 className="animate-spin" /> Summoning {quantity} hero{quantity === 1 ? "" : "es"}…</span></div>}

        {phase === "reveal" && <>
          <div className="sr-reveal-actions"><span aria-live="polite">{revealed.length} / {heroes.length} revealed</span>{!complete && <Button className="sr-secondary" onClick={() => setRevealed(heroes.map((hero) => hero.id))}>Reveal all</Button>}<Button className={complete ? "mh-mint" : "sr-secondary"} onClick={() => onOpenChange(false)}>{complete ? "Done" : "Skip reveal"}</Button></div>
          <div className="sr-cards">
            {heroes.map((hero, index) => {
              const shown = revealed.includes(hero.id);
              const tint = HERO_RARITY_DEFS[hero.rarity as HeroRarity]?.tint ?? 0x999fa6;
              const style = { "--sr-rarity": `#${tint.toString(16).padStart(6, "0")}` } as CSSProperties;
              return <button key={hero.id} type="button" className={`sr-card${shown ? " sr-card-revealed" : ""}`}
                data-rarity={hero.rarity} style={style}
                aria-label={shown ? `${hero.name}, ${hero.rarity}, level ${hero.level ?? 1}` : `Reveal hero ${index + 1}`}
                aria-pressed={shown}
                onClick={() => setRevealed((current) => current.includes(hero.id) ? current : [...current, hero.id])}>
                <span className="sr-flipper">
                  <span className="sr-card-back" aria-hidden={shown}><img src="/game/hud/summoning-card-back.webp" alt="" width={300} height={420} /></span>
                  <span className="sr-card-front" aria-hidden={!shown}>
                    <HeroArtwork hero={hero} />
                    <span className="hc-card-edge-stats">
                      {HERO_STATS.map(({ index: statIndex, key, label }) => <span key={key} className={`hc-card-edge-stat hc-card-edge-stat-${key}`} aria-label={`${label}: ${hero[key]}`}><HeroStatIcon index={statIndex} /><strong>{hero[key]}</strong></span>)}
                    </span>
                    <span className="sr-front-name">{hero.name.replace(/\s*#\d+\s*$/, "").trim()}</span>
                  </span>
                </span>
                <span className="sr-card-caption" aria-hidden={!shown}>
                  <strong>{shown ? hero.name : "\u00a0"}</strong><small>{shown ? `${hero.rarity} · Lv. ${hero.level ?? 1}` : "\u00a0"}</small>
                </span>
              </button>;
            })}
          </div>
        </>}
        {phase === "error" && <div className="sr-error-actions"><Button className="mh-mint" onClick={() => onOpenChange(false)}>Back to summoning</Button></div>}
      </div>
    </DialogContent>
  </Dialog>;
}
