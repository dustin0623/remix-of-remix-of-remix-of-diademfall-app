import { useRef, type ReactNode } from "react";
import { X, Zap } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { SessionHero } from "@/lib/game/session/types";
import "@/styles/hero-actions-popover.css";

/** Anchored to the card's lower-right edge; collision handling can flip it left. */
export function HeroActionsPopover({
  hero,
  open,
  onOpenChange,
  children,
  actions,
  restoreFocus = true,
  heading,
}: {
  hero: SessionHero;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  actions: ReactNode;
  restoreFocus?: boolean;
  /** Replaces the energy heading (e.g. a market price). */
  heading?: ReactNode;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const energy = Math.floor(hero.energy ?? hero.maxEnergy);
  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverAnchor asChild>
        <div className="hc-action-anchor" ref={anchor}>
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="ha-popover"
        side="right"
        align="end"
        sideOffset={10}
        collisionPadding={12}
        sticky="always"
        aria-label={`Actions for ${hero.name}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (restoreFocus) anchor.current?.querySelector("button")?.focus({ preventScroll: true });
        }}
      >
        <header className="ha-heading">
          <div>
            {heading ?? <strong className="inline-flex items-center gap-1.5" aria-label={`Energy ${energy} of ${hero.maxEnergy}`}>
              <Zap className="size-4" />
              {energy}/{hero.maxEnergy}
            </strong>}
          </div>
          <button type="button" aria-label="Close hero actions" onClick={() => onOpenChange(false)}>
            <X />
          </button>
        </header>
        <div className="ha-action-list">{actions}</div>
      </PopoverContent>
    </Popover>
  );
}
