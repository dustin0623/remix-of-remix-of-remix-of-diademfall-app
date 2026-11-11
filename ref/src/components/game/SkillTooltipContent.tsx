import { useState } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SKILL_INFO, type SkillId } from "@/lib/game/heroes/skills";
import "@/styles/skill-tooltip.css";

export function SkillTooltip({ id, icon }: { id: SkillId; icon: string }) {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild><span className="hc-skill" tabIndex={0} aria-label={SKILL_INFO[id].name}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
      <img src={icon} alt="" width={24} height={24} loading="lazy" />
    </span></TooltipTrigger>
    <SkillTooltipContent id={id} icon={icon} />
  </Tooltip>;
}

export function SkillTooltipContent({ id, icon }: { id: SkillId; icon: string }) {
  return <TooltipContent className="hud-skill-tooltip" side="top" sideOffset={8} collisionPadding={12}>
    <div className="hud-skill-tooltip-head"><img src={icon} alt="" /><strong>{SKILL_INFO[id].name}</strong></div>
    <p>{SKILL_INFO[id].effect}</p>
  </TooltipContent>;
}
