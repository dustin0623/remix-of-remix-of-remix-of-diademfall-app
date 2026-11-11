import { useMemo } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { HudIcon } from "@/components/layout/GameHud";
import { HousePhaserGame } from "@/components/game/HousePhaserGame";
import { energyAfterRest } from "@/lib/game/dungeon/rules";
import { HOUSE_TIERS, houseBonusFor, type PlayerHouse } from "@/lib/game/houses/houses";
import type { SessionHero } from "@/lib/game/session/types";

function liveEnergy(h: SessionHero, now: number) {
  const e = h.energy ?? h.maxEnergy;
  if (h.onMap) return e;
  return Math.floor(energyAfterRest(e, h.maxEnergy, now - (h.recoveryAt ?? now), !!h.skills?.includes("quick_rest"), houseBonusFor(h.houseRarity)));
}

/** Read-only house board; heroes enter and leave through the Heroes collection. */
export function HouseContent({ houses, heroes, selectedId, now }: {
  houses: PlayerHouse[] | null;
  heroes: SessionHero[];
  selectedId: string | null;
  now: number;
}) {
  const house = houses?.find((h) => h.id === selectedId) ?? houses?.[0];
  const tier = house ? HOUSE_TIERS[house.rarity] : null;
  const inside = house ? heroes.filter((h) => h.houseId === house.id) : [];

  return (
    <div className="hud-play-stage">

      <section className="hud-board-frame" aria-label="Your house">
        <section className="hud-status" aria-label="House status">
          <span className="hud-badge hud-stage">
            <span aria-hidden="true">✦</span> {tier ? `${tier.name.toUpperCase()} · ${inside.length}/${tier.slots}${house?.isDemo ? " · DEMO" : ""}` : "HOUSE"}
          </span>
        </section>
        <div className="hud-board">
          <HouseBoard houseId={house?.id ?? "empty"} inside={inside} now={now} />
          {!houses ? (
            <div className="hud-board-overlay"><div><Loader2 className="animate-spin" /><h2>Opening your house…</h2></div></div>
          ) : !house ? (
            <div className="hud-board-overlay">
              <div>
                <HudIcon index={1} />
                <h2>You don't have a house yet</h2>
                <p>Choose a demo house on your Profile so your heroes can rest faster.</p>
                <Link to="/profile" className="hud-action hud-red">Go to Profile</Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Same 41×25 board as the Play map, rendered in Phaser: border walls only,
 *  resting heroes wander slowly on the open grass inside. */
function HouseBoard({ houseId, inside, now }: { houseId: string; inside: SessionHero[]; now: number }) {
  const heroes = useMemo(
    () => inside.map((h) => ({ id: h.id, name: h.name, sprite: h.type || h.name, energy: liveEnergy(h, now), maxEnergy: h.maxEnergy })),
    [inside, now],
  );
  return (
    <ClientOnly fallback={null}>
      <HousePhaserGame key={houseId} heroes={heroes} className="hud-phaser" />
    </ClientOnly>
  );
}
