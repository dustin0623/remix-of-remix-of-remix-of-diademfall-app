import type { BannerId } from "./catalog/types";
import { ARTWORK } from "@/lib/artwork";

const { bastion_orders: bastion, wild_courts: wild, veil_covenant: veil, hollow_legions: hollow, skybound_houses: sky, wyrm_clans: wyrm } = ARTWORK.characters;

export interface BannerMeta {
  id: BannerId;
  name: string;
  motto: string;
  art: string;
  /** CSS variable holding the banner color token */
  color: string;
}

export const BANNERS: BannerMeta[] = [
  { id: "bastion_orders", name: "Bastion Orders", motto: "Hold the line, keep the law.", art: bastion, color: "var(--banner-bastion)" },
  { id: "wild_courts", name: "Wild Courts", motto: "The hunt never asks permission.", art: wild, color: "var(--banner-wild)" },
  { id: "veil_covenant", name: "Veil Covenant", motto: "Every thread can be cut.", art: veil, color: "var(--banner-veil)" },
  { id: "hollow_legions", name: "Hollow Legions", motto: "Death is only a muster call.", art: hollow, color: "var(--banner-hollow)" },
  { id: "skybound_houses", name: "Skybound Houses", motto: "Strike from where they cannot reach.", art: sky, color: "var(--banner-sky)" },
  { id: "wyrm_clans", name: "Wyrm Clans", motto: "Old blood, older fire.", art: wyrm, color: "var(--banner-wyrm)" },
];

export const BANNER_BY_ID = Object.fromEntries(BANNERS.map((b) => [b.id, b])) as Record<BannerId, BannerMeta>;
