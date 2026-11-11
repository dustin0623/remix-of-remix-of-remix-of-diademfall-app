import { useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroCardFace } from "./HeroCollectionCard";
import { HERO_RARITY_DEFS, type HeroRarity } from "@/game/data/HeroRarity";
import type { SessionHero } from "@/lib/game/session/types";
import "@/styles/heroes-collection.css";
import "@/styles/summoning-dialog.css";

/** In-page card opening scene (replaces the Shop content; never a pop-up). Presentation only. */
export function SummoningReveal({ phase, quantity, heroes, error, onClose }: {
  phase: "summoning" | "reveal" | "error"; quantity: number; heroes: SessionHero[]; error: string | null; onClose: () => void;
}) {
  const [revealed, setRevealed] = useState<string[]>([]);
  useEffect(() => { setRevealed([]); }, [heroes]);
  const complete = heroes.length > 0 && revealed.length === heroes.length;
  return <section className="sr-scene" aria-label="Hero card opening">
    <div className="sr-bar">
      <span className="sr-bar-count" aria-live="polite">
        {phase === "reveal" ? `${revealed.length} / ${heroes.length} revealed` : phase === "summoning" ? `Summoning ${quantity}…` : "Interrupted"}
      </span>
      <div className="sr-bar-center">
        {phase === "reveal" && <Button className="sr-flip-all" disabled={complete} onClick={() => setRevealed(heroes.map((h) => h.id))}>Flip all</Button>}
      </div>
      <div className="sr-bar-end">
        {phase !== "summoning" && <Button className={complete || phase === "error" ? "mh-mint sr-skip" : "sr-secondary sr-skip"} onClick={onClose}>
          {phase === "error" ? "Back" : complete ? "Done" : "Skip"} <ChevronRight />
        </Button>}
      </div>
    </div>
    {phase === "summoning" && <div className="sr-pending" role="status"><img src="/game/hud/summoning-gate.webp" alt="" /><span><Loader2 className="animate-spin" /> Summoning {quantity} hero{quantity === 1 ? "" : "es"}…</span></div>}
    {phase === "error" && <p className="sr-scene-error" role="alert">{error ?? "Summoning failed"}</p>}
    {phase === "reveal" && <div className="sr-cards">
      {heroes.map((hero, index) => {
        const shown = revealed.includes(hero.id);
        const tint = HERO_RARITY_DEFS[hero.rarity as HeroRarity]?.tint ?? 0x999fa6;
        const style = { "--sr-rarity": `#${tint.toString(16).padStart(6, "0")}` } as CSSProperties;
        return <button key={hero.id} type="button" className={`sr-card${shown ? " sr-card-revealed" : ""}`}
          data-rarity={hero.rarity} style={style} aria-pressed={shown}
          aria-label={shown ? `${hero.name}, ${hero.rarity}, level ${hero.level ?? 1}` : `Reveal hero ${index + 1}`}
          onClick={() => setRevealed((c) => c.includes(hero.id) ? c : [...c, hero.id])}>
          <span className="sr-flipper">
            <span className="sr-card-back" aria-hidden={shown}><img src="/game/hud/summoning-card-back.webp" alt="" width={300} height={420} /></span>
            <span className="sr-card-front" aria-hidden={!shown}>
              <span className="hc-card" data-rarity={hero.rarity}><HeroCardFace hero={hero} showFlag={false} /></span>
            </span>
          </span>
        </button>;
      })}
    </div>}
  </section>;
}
