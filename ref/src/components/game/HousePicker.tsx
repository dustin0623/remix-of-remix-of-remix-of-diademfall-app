import { useRef, useState } from "react";
import { ArrowRight, BedDouble, Check, Loader2, Zap } from "lucide-react";
import { HOUSE_RARITIES, HOUSE_TIERS, type HouseRarity } from "@/lib/game/houses/houses";
import { ENERGY_RECOVERY_PER_HOUR } from "@/lib/config/constants/game";
import "@/styles/house-picker.css";

/** Demo catalog only: these choices do not represent owned or minted NFTs. */
export function HousePicker({
  selected,
  loading = false,
  error,
  onChoose,
  onOpen,
}: {
  selected: HouseRarity | null;
  loading?: boolean;
  error?: string | null;
  onChoose: (rarity: HouseRarity) => Promise<void>;
  onOpen?: () => void;
}) {
  const [busy, setBusy] = useState<HouseRarity | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false);
  const choose = async (rarity: HouseRarity) => {
    if (pending.current || rarity === selected || loading) return;
    pending.current = true;
    setBusy(rarity);
    setMessage(null);
    try {
      await onChoose(rarity);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not select house. Try again.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  };
  return (
    <section className="hp-section" aria-label="Choose your demo house">
      <header className="pf-section-heading">
        <div>
          <span className="pf-eyebrow">Make yourself at home</span>
          <h2>
            Choose your house <span className="hp-demo">Demo</span>
          </h2>
          <p>
            Try every house tier before house NFTs arrive. Your choice is used on the House page.
          </p>
        </div>
        {onOpen && (
          <button
            className="pf-secondary"
            onClick={onOpen}
            disabled={!selected || loading || !!busy}
          >
            Open house <ArrowRight />
          </button>
        )}
      </header>
      <div className="hp-grid" aria-busy={loading || !!busy}>
        {HOUSE_RARITIES.map((rarity, index) => {
          const tier = HOUSE_TIERS[rarity],
            active = selected === rarity;
          return (
            <article key={rarity} className="hp-house" data-rarity={rarity} data-selected={active}>
              <span
                className="hp-house-art"
                style={{
                  backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`,
                }}
                role="img"
                aria-label={tier.name}
              />
              <span className="hp-rarity">{rarity}</span>
              <h3>{tier.name}</h3>
              <div className="hp-benefits">
                <span>
                  <BedDouble />
                  {tier.slots} {tier.slots === 1 ? "bed" : "beds"}
                </span>
                <span>
                  <Zap />
                  {ENERGY_RECOVERY_PER_HOUR + tier.bonusPerHour} energy/hr
                </span>
              </div>
              <p className="hp-bonus">+{tier.bonusPerHour} house bonus per hour</p>
              <button
                type="button"
                className={`hp-choose ${active ? "hp-active" : ""}`}
                disabled={loading || !!busy || active}
                aria-label={active ? `${tier.name} selected` : `Use ${tier.name}`}
                onClick={() => void choose(rarity)}
              >
                {busy === rarity ? (
                  <>
                    <Loader2 className="animate-spin" /> Switching…
                  </>
                ) : active ? (
                  <>
                    <Check />
                    Selected
                  </>
                ) : loading ? (
                  "Loading…"
                ) : (
                  "Use house"
                )}
              </button>
            </article>
          );
        })}
      </div>
      <p className="hp-note">
        Switching houses returns resting heroes to your roster. Demo selections do not mint or
        purchase an NFT.
      </p>
      {(error || message) && (
        <p className="hp-error" role="alert">
          {message ?? error}
        </p>
      )}
    </section>
  );
}
