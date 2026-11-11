import { optimizedImage } from "@/lib/assets/optimized-images";
export const HERO_STATS = [
  { key: "power", label: "Power", index: 0 },
  { key: "speed", label: "Speed", index: 1 },
  { key: "stamina", label: "Stamina", index: 2 },
  { key: "bombNumber", label: "Bomb capacity", index: 3 },
  { key: "bombRange", label: "Blast range", index: 4 },
] as const;

const STAT_ICON_FILES = ["power", "speed", "stamina", "bombs", "range"] as const;

export function HeroStatIcon({ index, size = 24 }: { index: number; size?: number }) {
  const file = STAT_ICON_FILES[index] ?? "power";
  return (
    <img
      aria-hidden="true"
      alt=""
      src={optimizedImage(`/game/stats/${file}.png`)}
      width={size}
      height={size}
      loading="lazy"
      className="hero-stat-icon inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
