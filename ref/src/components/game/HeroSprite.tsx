import { cn } from "@/lib/utils";
import { HERO_SPRITES, heroSheet } from "@/game/data/HeroRarity";

const KNOWN = new Map(Object.values(HERO_SPRITES).map((key) => [key.replace(/[^a-z]/g, ""), key]));
// Renamed heroes keep their original sprite sheets.
for (const [alias, key] of ([["rick", "ricky"], ["moss", "mossy"], ["ghost", "ghosty"], ["tim", "timmy"]] as const)) KNOWN.set(alias, key);

/** Maps a hero name/type ("Pinky #3", "Red Horn") to its lowercase sprite sheet key. */
export function resolveHeroSpriteKey(name: string | undefined | null): string {
  const key = (name ?? "")
    .replace(/#\d+/g, "")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
  return KNOWN.get(key) ?? "ricky";
}

/** One 16×20 frame of a 48×80 hero sheet (3 cols × 4 rows: down, left, right, up), crisp pixels. */
export function HeroSprite({
  sprite,
  scale = 4,
  row = 0,
  frame = 1,
  className,
}: {
  sprite: string;
  scale?: number;
  row?: number;
  frame?: number;
  className?: string;
}) {
  const key = resolveHeroSpriteKey(sprite);
  const sheet = heroSheet(key);
  const height = 20 * scale;
  const width = (height * sheet.frameW) / sheet.frameH;
  return (
    <div
      role="img"
      aria-label={key}
      className={cn("shrink-0", className)}
      style={{
        width,
        height,
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${3 * width}px ${4 * height}px`,
        backgroundPosition: `-${width * frame}px -${height * row}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}
