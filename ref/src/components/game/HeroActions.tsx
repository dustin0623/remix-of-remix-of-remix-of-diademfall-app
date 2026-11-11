import { useState } from "react";
import { ArrowUp, Hammer, Home, MoreHorizontal, Swords, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canDeployEnergy, MAX_ON_MAP } from "@/lib/config/constants/game";
import type { SessionHero } from "@/lib/game/session/types";
import { MAX_HERO_LEVEL } from "@/lib/game/heroes/leveling";

export function HeroActions({
  hero,
  onMapCount,
  onToggle,
  onLevelUp,
  onSell,
  onCancelSale,
  onRestInHouse,
  onLeaveHouse,
  disabled = false,
  prominentUpgrade = false,
  layout = "default",
}: {
  hero: SessionHero;
  onMapCount: number;
  onToggle: () => void | Promise<void>;
  /** Open the level-up dialog; omit to hide it (e.g. inside the live game). */
  onLevelUp?: () => void;
  /** Open the sell dialog; omit to keep selling disabled (e.g. inside the live game). */
  onSell?: () => void;
  onCancelSale?: () => void | Promise<void>;
  /** House actions; omit to hide them (e.g. inside the live game). */
  onRestInHouse?: () => void;
  onLeaveHouse?: () => void | Promise<void>;
  disabled?: boolean;
  prominentUpgrade?: boolean;
  layout?: "default" | "popover";
}) {
  const [busy, setBusy] = useState(false);
  const energy = hero.energy ?? hero.maxEnergy;
  const deployable =
    !hero.listed &&
    !hero.houseId &&
    canDeployEnergy(energy, hero.maxEnergy) &&
    onMapCount < MAX_ON_MAP;
  const label = hero.houseId
    ? "In house"
    : hero.listed
      ? `Listed · ${hero.marketPrice ?? 0}`
      : hero.onMap
        ? "Recall"
        : energy < 1
          ? "Sleeping"
          : onMapCount >= MAX_ON_MAP
            ? "Map full"
            : !canDeployEnergy(energy, hero.maxEnergy)
              ? "Needs 50%"
              : "Deploy";
  const toggle = async () => {
    if (busy || disabled || (!hero.onMap && !deployable)) return;
    setBusy(true);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  };
  if (layout === "popover") {
    const capped = (hero.level ?? 1) >= MAX_HERO_LEVEL;
    return (
      <>
        <Button
          disabled={busy || disabled || (!hero.onMap && !deployable)}
          onClick={() => void toggle()}
        >
          <Swords />
          {busy ? "Saving…" : label}
        </Button>
        <Button disabled={disabled || !onLevelUp || capped || !!hero.listed} onClick={onLevelUp}>
          <ArrowUp />
          Upgrade
        </Button>
        {hero.listed ? (
          <Button disabled={disabled || !onCancelSale} onClick={() => void onCancelSale?.()}>
            <Tag />
            Cancel sale
          </Button>
        ) : (
          <Button disabled={disabled || !onSell || !!hero.onMap || !!hero.houseId} onClick={onSell}>
            <Tag />
            Sell
          </Button>
        )}
        {hero.houseId && onLeaveHouse ? (
          <Button disabled={disabled} onClick={() => void onLeaveHouse()}>
            <Home />
            Leave house
          </Button>
        ) : (
          onRestInHouse && (
            <Button disabled={disabled || !!hero.onMap || !!hero.listed} onClick={onRestInHouse}>
              <Home />
              Rest in house
            </Button>
          )
        )}
      </>
    );
  }
  return (
    <>
      <Button
        size="sm"
        className="min-h-11 min-w-0 flex-1"
        variant={hero.onMap ? "outline" : "default"}
        disabled={busy || disabled || (!hero.onMap && !deployable)}
        onClick={() => void toggle()}
      >
        {prominentUpgrade && <Swords aria-hidden="true" />}
        {busy ? "Saving…" : prominentUpgrade && label === "Deploy" ? "Deploy to Crew" : label}
      </Button>
      {prominentUpgrade && onLevelUp && (
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          disabled={disabled}
          onClick={onLevelUp}
        >
          <ArrowUp /> Upgrade
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="size-11 shrink-0"
            aria-label={`More actions for ${hero.name}`}
            title="More actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onLevelUp && (
            <DropdownMenuItem disabled={disabled} className="min-h-11" onSelect={() => onLevelUp()}>
              <Hammer /> Level up <span className="ml-auto text-xs">Lv. {hero.level ?? 1}</span>
            </DropdownMenuItem>
          )}
          {hero.houseId && onLeaveHouse ? (
            <DropdownMenuItem
              disabled={disabled}
              className="min-h-11"
              onSelect={() => void onLeaveHouse()}
            >
              <Home /> Leave house
            </DropdownMenuItem>
          ) : onRestInHouse ? (
            <DropdownMenuItem
              disabled={disabled || !!hero.onMap || !!hero.listed}
              className="min-h-11"
              onSelect={() => onRestInHouse()}
            >
              <Home /> Rest in house
              {hero.onMap ? <span className="ml-auto text-xs">Recall first</span> : null}
            </DropdownMenuItem>
          ) : null}
          {hero.listed ? (
            <DropdownMenuItem
              disabled={!onCancelSale || disabled}
              className="min-h-11"
              onSelect={() => void onCancelSale?.()}
            >
              <Tag /> Cancel sale
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={!onSell || disabled || !!hero.onMap || !!hero.houseId}
              className="min-h-11"
              onSelect={() => onSell?.()}
            >
              <Tag /> Sell
              {hero.onMap ? <span className="ml-auto text-xs">Recall first</span> : null}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
