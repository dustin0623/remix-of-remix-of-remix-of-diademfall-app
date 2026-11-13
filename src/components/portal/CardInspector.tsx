import { AbilityIcon } from "@/components/game/AbilityIcon";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ABILITY_BY_ID,
  SummonerCardView,
  UnitCardView,
  summonerEffectText,
} from "@/components/game/cards";
import type { SummonerDefinition } from "@/game/catalog/types";
import { BANNER_BY_ID } from "@/game/banners";
import { unitAtLevel, type UnitCard } from "@/game/units";

export type InspectedCard =
  { kind: "unit"; card: UnitCard } | { kind: "summoner"; card: SummonerDefinition };

export function CardInspector({
  selection,
  onClose,
}: {
  selection: InspectedCard | null;
  onClose: () => void;
}) {
  const [level, setLevel] = useState(1);
  const card = selection?.card;
  const unit = selection?.kind === "unit" ? unitAtLevel(selection.card, level) : null;
  return (
    <Dialog
      open={!!selection}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setLevel(1);
        }
      }}
    >
      <DialogContent className="card-inspector max-w-2xl">
        <DialogHeader>
          <p className="portal-eyebrow">
            {card?.banner ? BANNER_BY_ID[card.banner].name : "Wayfarers"} · {card?.rarity}
          </p>
          <DialogTitle className="font-display text-2xl text-primary">{card?.name}</DialogTitle>
          <DialogDescription>
            {card?.set} edition · {card?.mana} mana ·{" "}
            {selection?.kind === "unit" ? "Troop" : "Commander"}
          </DialogDescription>
        </DialogHeader>
        {selection && card && (
          <div className="inspector-layout">
            <div className="inspector-card">
              {unit ? (
                <UnitCardView u={unit} />
              ) : selection.kind === "summoner" ? (
                <SummonerCardView s={selection.card} />
              ) : null}
              <span>Catalog preview · Not an owned card</span>
            </div>
            <div className="inspector-details">
              {unit && (
                <label className="inspector-level">
                  Preview level{" "}
                  <strong>
                    {level} / {card.levelCap}
                  </strong>
                  <input
                    aria-label="Preview card level"
                    type="range"
                    min={1}
                    max={card.levelCap}
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                  />
                  <small>Stats and abilities update for the selected level.</small>
                </label>
              )}
              <h3>{unit ? "Active abilities" : "Commander effects"}</h3>
              {unit ? (
                unit.abilities.length ? (
                  unit.abilities.map((id) => (
                    <div className="inspector-ability" key={id}>
                      <strong className="flex items-center gap-2">
                        <AbilityIcon id={id} decorative className="size-10" />
                        {ABILITY_BY_ID[id]?.name ?? id}
                      </strong>
                      <p>{ABILITY_BY_ID[id]?.mechanics}</p>
                    </div>
                  ))
                ) : (
                  <p>No abilities unlocked at this level.</p>
                )
              ) : selection.kind === "summoner" ? (
                <>
                  <ul>
                    {summonerEffectText(selection.card).map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                  <p className="inspector-lore">{selection.card.lore}</p>
                </>
              ) : null}
              {unit?.role && (
                <p>
                  <strong>Role:</strong> {unit.role.replace(/_/g, " ")}
                </p>
              )}
              <Link to="/battle" className="play-small-button" onClick={onClose}>
                Try cards in Practice
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
