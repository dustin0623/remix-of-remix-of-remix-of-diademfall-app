import { optimizedImage } from "@/lib/assets/optimized-images";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { HeroCardFace, HeroCollectionCard } from "./HeroCollectionCard";
import { DEFAULT_FILTERS, HeroCollectionFilters } from "./HeroFilters";
import { Button } from "@/components/ui/button";
import { FUSION_INPUTS, FUSION_RECIPES, fusedLevel } from "@/lib/game/heroes/leveling";
import { filterHeroes, sortHeroes } from "@/lib/game/heroes/ranking";
import type { SessionHero } from "@/lib/game/session/types";
import "@/styles/heroes-collection.css";
import "@/styles/fusion.css";

export interface FusionOutcome {
  success: boolean;
  hero?: SessionHero | undefined;
  message: string;
}
type Step = "forge" | "collection" | "review" | "fusing" | "result";
const forgeImage = "/game/hud/fusion-forge.webp";
const emblem = (rarity: string) => optimizedImage(`/game/emblems/${rarity}_emblem.png`);

/** In-page wizard. Only the final review action invokes the supplied server/mock adapter. */
export function FusionContent({
  heroes,
  coins,
  fuse,
}: {
  heroes: SessionHero[] | null;
  coins: number | null;
  fuse: (heroIds: string[]) => Promise<FusionOutcome>;
}) {
  const [step, setStep] = useState<Step>("forge");
  const [tier, setTier] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FusionOutcome | null>(null);
  const inFlight = useRef(false);
  const scene = useRef<HTMLElement>(null);
  useEffect(() => {
    const heading = scene.current?.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    if (scene.current?.parentElement) scene.current.parentElement.scrollTop = 0;
  }, [step]);
  const recipe = FUSION_RECIPES[tier]!;
  const eligible = (heroes ?? []).filter(
    (h) => h.rarity === recipe.from && !h.onMap && !h.listed && !h.houseId && !h.burned,
  );
  const selected = picked.flatMap((id) => {
    const hero = eligible.find((h) => h.id === id);
    return hero ? [hero] : [];
  });
  const selectedIds = selected.map((h) => h.id);
  const ready = selected.length === FUSION_INPUTS;
  const affordable = coins !== null && coins >= recipe.fee;
  const shown = sortHeroes(filterHeroes(eligible, filters), filters.sort);
  const toggle = (id: string) => {
    if (!eligible.some((h) => h.id === id)) return;
    setError(null);
    setPicked(
      selectedIds.includes(id)
        ? selectedIds.filter((key) => key !== id)
        : selectedIds.length < FUSION_INPUTS
          ? [...selectedIds, id]
          : selectedIds,
    );
  };
  const reset = () => {
    setStep("forge");
    setPicked([]);
    setFilters(DEFAULT_FILTERS);
    setError(null);
    setOutcome(null);
  };
  const run = async () => {
    if (inFlight.current || step !== "review" || !ready || !affordable) return;
    inFlight.current = true;
    setError(null);
    setStep("fusing");
    try {
      setOutcome(await fuse(selectedIds));
      setPicked([]);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fusion could not be completed. Please try again.");
      setStep("review");
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <section ref={scene} className={`fu-page fu-step-${step}`} aria-label="Hero fusion">
      {step === "forge" && (
        <>
          <div className="fu-tiers" role="tablist" aria-label="Fusion rarity">
            {FUSION_RECIPES.map((r, index) => (
              <button
                key={r.from}
                id={`fusion-tier-${index}`}
                type="button"
                role="tab"
                aria-selected={tier === index}
                aria-controls="fusion-ritual"
                tabIndex={tier === index ? 0 : -1}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (tier + 1) % FUSION_RECIPES.length
                      : event.key === "ArrowLeft"
                        ? (tier + FUSION_RECIPES.length - 1) % FUSION_RECIPES.length
                        : null;
                  if (next !== null) {
                    event.preventDefault();
                    setTier(next);
                    setPicked([]);
                    document.getElementById(`fusion-tier-${next}`)?.focus();
                  }
                }}
                onClick={() => {
                  setTier(index);
                  setPicked([]);
                  setFilters(DEFAULT_FILTERS);
                  setError(null);
                }}
              >
                <img src={emblem(r.from)} alt="" />
                <span>
                  <strong>
                    {r.from} <ArrowRight /> {r.to}
                  </strong>
                  <small>{Math.round(r.chance * 100)}% success</small>
                </span>
              </button>
            ))}
          </div>
          <div
            id="fusion-ritual"
            className="fu-ritual"
            role="tabpanel"
            aria-labelledby={`fusion-tier-${tier}`}
          >
            <header className="fu-heading">
              <p>The fusion forge</p>
              <h1>Forge a stronger hero</h1>
              <span>Three heroes. One new possibility.</span>
            </header>
            <img
              className="fu-forge-art"
              src={forgeImage}
              alt="Enchanted bronze fusion forge"
              width={1024}
              height={1024}
            />
            <div className="fu-dock">
              <div className="fu-summary">
                <span>
                  Success chance<strong>{Math.round(recipe.chance * 100)}%</strong>
                </span>
                <span>
                  Fusion fee
                  <strong>
                    <img src="/game/items/token.png" alt="" />
                    {recipe.fee.toLocaleString()} coins
                  </strong>
                </span>
                <span>
                  Available heroes
                  <strong>
                    {heroes === null ? "—" : eligible.length} <em>{recipe.from}</em>
                  </strong>
                </span>
              </div>{" "}
              <Button
                className="fu-primary"
                disabled={heroes === null || eligible.length < FUSION_INPUTS}
                onClick={() => {
                  setStep("collection");
                  setError(null);
                }}
              >
                <Sparkles />
                <span aria-live="polite">
                  {heroes === null
                    ? "Loading your collection…"
                    : eligible.length < FUSION_INPUTS
                      ? `Need ${FUSION_INPUTS} available ${recipe.from} heroes`
                      : `Choose ${FUSION_INPUTS} heroes`}
                </span>
              </Button>
            </div>
          </div>
        </>
      )}

      {step === "collection" && (
        <div className="fu-collection">
          <header className="fu-collection-head">
            <Button className="fu-secondary" aria-label="Back to forge" onClick={reset}>
              <ArrowLeft /> <span>Back to forge</span>
            </Button>
            <div>
              <h1>
                Choose {FUSION_INPUTS} {recipe.from} heroes
              </h1>
              <p>Heroes in the mine, in a house, or listed for sale are unavailable.</p>
            </div>
            <div className="fu-top-controls">
              <HeroCollectionFilters value={filters} onChange={setFilters} heroes={eligible} />
            </div>
          </header>
          <div className="fu-gallery">
            {!heroes ? (
              <p className="fu-empty" role="status">
                <Loader2 className="animate-spin" /> Loading your collection…
              </p>
            ) : shown.length === 0 ? (
              <p className="fu-empty">
                {eligible.length
                  ? "No heroes match your search."
                  : `No available ${recipe.from} heroes. Choose another fusion tier.`}
              </p>
            ) : (
              <div className="hc-grid fu-grid">
                {shown.map((hero) => (
                  <div
                    key={hero.id}
                    className={`fu-pick${selectedIds.includes(hero.id) ? " fu-picked" : ""}`}
                  >
                    <HeroCollectionCard
                      hero={hero}
                      selected={selectedIds.includes(hero.id)}
                      onSelect={() => toggle(hero.id)}
                    />
                    {selectedIds.includes(hero.id) && (
                      <span className="fu-pick-number" aria-hidden="true">
                        <Check />
                        {selectedIds.indexOf(hero.id) + 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="fu-floating-review">
            <Button
              className="fu-primary"
              disabled={!ready}
              onClick={() => {
                setStep("review");
                setError(null);
              }}
            >
              Review fusion{" "}
              <span aria-live="polite">
                ({selected.length}/{FUSION_INPUTS})
              </span>{" "}
              <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="fu-review">
          <header className="fu-heading">
            <p>The final step</p>
            <h1>Review your fusion</h1>
            <span>Confirm your heroes before awakening the forge.</span>
          </header>
          <div className="fu-review-heroes">
            {selected.map((hero) => (
              <div key={hero.id} className="hc-card" data-rarity={hero.rarity}>
                <HeroCardFace hero={hero} />
              </div>
            ))}
          </div>
          <div className="fu-projection">
            <ArrowRight />
            <img src={emblem(recipe.to)} alt="" />
            <span>
              Possible result
              <strong>
                {recipe.to} · Lv. {ready ? fusedLevel(selected.map((h) => h.level ?? 1)) : "—"}
              </strong>
            </span>
          </div>
          <div className="fu-review-dock">
            <div className="fu-summary">
              <span>
                Success chance<strong>{Math.round(recipe.chance * 100)}%</strong>
              </span>
              <span>
                Fusion fee<strong>{recipe.fee.toLocaleString()} coins</strong>
              </span>
              <span>
                Your balance
                <strong>{coins === null ? "—" : `${coins.toLocaleString()} coins`}</strong>
              </span>
            </div>
            <p className="fu-consequences">
              On success, all three heroes are consumed to create one {recipe.to} hero. On failure,
              only the weakest hero is consumed; the other two remain. The fee is charged for either
              outcome.
            </p>
            {!ready && (
              <p className="fu-error" role="alert">
                Your selection has changed. Choose three available heroes again.
              </p>
            )}
            {!affordable && (
              <p className="fu-error" role="status">
                {coins === null
                  ? "Loading your coin balance…"
                  : "Not enough coins for this fusion."}
              </p>
            )}
            {error && (
              <p className="fu-error" role="alert">
                {error}
              </p>
            )}
            <div className="fu-review-actions">
              <Button className="fu-secondary" onClick={() => setStep("collection")}>
                <ArrowLeft /> Change heroes
              </Button>
              <Button
                className="fu-primary"
                disabled={!ready || !affordable}
                onClick={() => void run()}
              >
                <Sparkles /> Fuse for {recipe.fee.toLocaleString()} coins
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "fusing" && (
        <div className="fu-waiting" role="status" aria-live="polite">
          <img className="fu-forge-art fu-brewing" src={forgeImage} alt="" />
          <h1>The forge is awakening</h1>
          <p>
            <Loader2 className="animate-spin" /> Fusing your heroes…
          </p>
        </div>
      )}
      {step === "result" && outcome && (
        <div className="fu-outcome">
          <header className="fu-heading">
            <p>The forge has spoken</p>
            <h1>{outcome.success ? "Fusion complete" : "The fusion faded"}</h1>
            <span role="status">{outcome.message}</span>
          </header>
          {outcome.success && outcome.hero ? (
            <div className="hc-card fu-outcome-card" data-rarity={outcome.hero.rarity}>
              <HeroCardFace hero={outcome.hero} showFlag={false} />
            </div>
          ) : (
            <img className="fu-forge-art" src={forgeImage} alt="" />
          )}
          <Button className="fu-primary" onClick={reset}>
            Back to forge <ArrowRight />
          </Button>
        </div>
      )}
    </section>
  );
}
