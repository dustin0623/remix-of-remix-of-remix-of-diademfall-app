import { useState, type ReactNode } from "react";
import { ABILITIES } from "@/game/catalog/abilities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AbilityIcon } from "./AbilityIcon";

/** Matches ref/SkillTooltipContent: copper border, painted header, icon/name and readable effect. */
export function AbilityTooltip({
  title,
  description,
  icon,
  children,
  className,
  label = title,
  target,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
  target?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            className={cn("ability-tooltip-trigger", className)}
            role="img"
            aria-label={label}
            data-target={target}
            tabIndex={0}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                setOpen((value) => !value);
              }
            }}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent
          className="game-ability-tooltip"
          side="top"
          sideOffset={8}
          collisionPadding={12}
        >
          <div className="game-ability-tooltip-head">
            <span className="game-ability-tooltip-icon" aria-hidden="true">
              {icon}
            </span>
            <strong>{title}</strong>
          </div>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TroopAbilityTooltip({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children?: ReactNode;
}) {
  const ability = ABILITIES.find((a) => a.id === id);
  if (!ability) return null;
  return (
    <AbilityTooltip
      title={ability.name}
      description={ability.mechanics}
      icon={<AbilityIcon id={id} decorative />}
      className={className ?? ""}
    >
      {children ?? <AbilityIcon id={id} decorative />}
    </AbilityTooltip>
  );
}
