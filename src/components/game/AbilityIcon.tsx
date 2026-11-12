import { ABILITIES } from "@/game/catalog/abilities";
import { cn } from "@/lib/utils";
const KNOWN_ABILITIES = new Set(ABILITIES.map((ability) => ability.id));
function abilityIconPath(id: string): string | undefined {
  return KNOWN_ABILITIES.has(id) ? "/assets/abilities/" + id + ".png" : undefined;
}
export function AbilityIcon({
  id,
  className,
  decorative = false,
}: {
  id: string;
  className?: string;
  decorative?: boolean;
}) {
  const src = abilityIconPath(id);
  if (!src) return null;
  const name = ABILITIES.find((ability) => ability.id === id)?.name ?? id;
  return (
    <img
      src={src}
      alt={decorative ? "" : name}
      width={150}
      height={152}
      loading="lazy"
      className={cn("ability-icon", className)}
    />
  );
}
