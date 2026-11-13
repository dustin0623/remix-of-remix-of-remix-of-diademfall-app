import type { BannerId, Rarity } from "@/game/catalog/types";
import { cn } from "@/lib/utils";

export function BannerCrest({
  banner,
  className,
}: {
  banner: BannerId | "wayfarer";
  className?: string;
}) {
  return (
    <img
      className={cn("game-banner-crest", className)}
      src={`/assets/banners/crests/${banner}.png`}
      width={96}
      height={96}
      alt=""
      loading="lazy"
    />
  );
}

export function RarityEmblem({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <img
      className={cn("game-rarity-emblem", className)}
      src={`/assets/raw/rarity-emblems/${rarity}.png`}
      width={96}
      height={96}
      alt=""
      loading="lazy"
    />
  );
}
