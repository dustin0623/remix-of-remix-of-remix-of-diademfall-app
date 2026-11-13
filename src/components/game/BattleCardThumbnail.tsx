import { useRef, useState } from "react";
import { Portal as HoverCardPortal } from "@radix-ui/react-hover-card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { displaySummoner, displayUnit } from "@/game/catalogs";
import type { TeamPick } from "@/game/match";
import { unitAtLevel } from "@/game/units";
import { regularCardArt } from "@/lib/card-art";
import { CardFace } from "./CardFace";
import { summonerEffectText } from "./cards";

type ArtCard = Parameters<typeof regularCardArt>[0];

/** Use the same upper portrait crop in the formation, arena, and match summaries. */
export function BattleCardCrop({ card }: { card: ArtCard }) {
  return (
    <span className="battle-card-crop" aria-hidden="true">
      <img src={regularCardArt(card)} alt="" draggable={false} />
    </span>
  );
}

function BattleCardThumbnail({
  id,
  level,
  summoner,
}: {
  id: string;
  level?: number | undefined;
  summoner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const leader = summoner ? displaySummoner(id) : undefined;
  const troop = summoner ? undefined : displayUnit(id);
  const card = leader ?? troop;
  if (!card) return <span className="match-overview-slot" aria-hidden="true" />;
  const fullCard = (
    <CardFace
      card={leader ? { ...leader, cardType: "summoner" } : card}
      mana={card.mana}
      {...(troop ? { unit: unitAtLevel(troop, level) } : {})}
      {...(leader ? { effects: leader.effects, effectText: summonerEffectText(leader) } : {})}
    />
  );
  return (
    <>
      <HoverCard openDelay={120} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            ref={trigger}
            type="button"
            className="match-overview-slot"
            aria-label={`Inspect ${card.name}`}
            onClick={() => setOpen(true)}
          >
            <BattleCardCrop card={card} />
          </button>
        </HoverCardTrigger>
        {!open && (
          <HoverCardPortal>
            <HoverCardContent
              side="top"
              sideOffset={8}
              collisionPadding={16}
              className="battle-card-preview"
            >
              <div className="battle-full-card">{fullCard}</div>
            </HoverCardContent>
          </HoverCardPortal>
        )}
      </HoverCard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="battle-card-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">{card.name}</DialogTitle>
          <DialogDescription className="sr-only">Card details</DialogDescription>
          <div className="battle-full-card">{fullCard}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BattleLineup({
  team,
  slots,
}: {
  team: TeamPick | null | undefined;
  slots: number;
}) {
  const ids = team ? [team.summonerId, ...team.unitIds] : [];
  return (
    <div className="match-overview-lineup" aria-label="Formation" role="group">
      {Array.from({ length: slots + 1 }, (_, i) => {
        const id = ids[i];
        return id ? (
          <BattleCardThumbnail
            key={`${i}-${id}`}
            id={id}
            level={team?.levels?.[id]}
            summoner={i === 0}
          />
        ) : (
          <span key={i} className="match-overview-slot" aria-hidden="true" />
        );
      })}
    </div>
  );
}
