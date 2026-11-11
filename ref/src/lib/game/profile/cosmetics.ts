/** Stable persisted IDs: avatars 0–19, backgrounds 200–219. Visual slots are 1–20. */
import { optimizedImage } from "@/lib/assets/optimized-images";
export type CosmeticKind = "avatar" | "background";
export interface CosmeticTemplateEntry {
  templateId: number;
  slot: number;
  kind: CosmeticKind;
  name: string;
  image: string;
  collection: "heroes" | "special";
  soulbound: boolean;
  requiredLevel: number;
}

export const PARTNERSHIP_SLOTS = [21, 22, 23, 24, 25] as const;
export const DEFAULT_AVATAR_TEMPLATE_ID = 0;
export const DEFAULT_BACKGROUND_TEMPLATE_ID = 200;
export const DEFAULT_COSMETIC: Record<CosmeticKind, number> = { avatar: 0, background: 200 };

const avatars = [
  ["rick", "Rick"],
  ["rocky", "Rocky"],
  ["rascal", "Rascal"],
  ["red-horn", "Red Horn"],
  ["ducky", "Ducky"],
  ["bolt", "Bolt"],
  ["pinky", "Pinky"],
  ["moss", "Moss"],
  ["ghost", "Ghost"],
  ["tim", "Tim"],
  ["ape", "Ape"],
  ["bchamp", "BChamp"],
  ["betzy", "Betzy"],
  ["drop", "Drop"],
  ["fuzzy", "Fuzzy"],
  ["gib", "Gib"],
  ["pheonix", "Pheonix"],
  ["ramp", "Ramp"],
  ["seal", "Seal"],
  ["toshinaka", "Toshinaka"],
] as const;
const backgrounds = [
  ["mine-valley", "Vexaria Valley"],
  ["ember-canyon", "Ember Canyon"],
  ["moonlit-grove", "Moonlit Grove"],
  ["frostfall", "Frostfall"],
  ["sunstone-desert", "Sunstone Desert"],
  ["sky-isles", "Sky Isles"],
  ["coral-harbor", "Coral Harbor"],
  ["amethyst-hollow", "Amethyst Hollow"],
  ["autumn-reach", "Autumn Reach"],
  ["stormwatch", "Stormwatch"],
  ["ape", "Ape's Lantern District"],
  ["bchamp", "Champion's Arena"],
  ["betzy", "Betzy's Neon City"],
  ["drop", "Golden Palace"],
  ["fuzzy", "Fuzzy's Wildwood"],
  ["gib", "Gib's Riverside"],
  ["pheonix", "Pheonix's Redrock Run"],
  ["ramp", "Ramp's Moon Keep"],
  ["seal", "Seal's Polar Coast"],
  ["toshinaka", "Toshinaka's Sakura Shrine"],
] as const;

function entries(
  kind: CosmeticKind,
  sources: readonly (readonly [string, string])[],
): CosmeticTemplateEntry[] {
  return sources.map(([slug, name], index) => ({
    templateId: (kind === "avatar" ? 0 : 200) + index,
    slot: index + 1,
    kind,
    name,
    image: optimizedImage(`/assets/${kind === "avatar" ? "avatars" : "backgrounds"}/${String(index + 1).padStart(2, "0")}-${slug}.png${kind === "avatar" ? "?v=front-20261108" : ""}`),
    collection: index < 10 ? "heroes" : "special",
    soulbound: index === 0,
    requiredLevel: (index + 1) * 4,
  }));
}
const ALL = [...entries("avatar", avatars), ...entries("background", backgrounds)];
const BY_ID = new Map(ALL.map((entry) => [entry.templateId, entry]));
export function getCosmetic(
  templateId: number,
  kind?: CosmeticKind,
): CosmeticTemplateEntry | undefined {
  const entry = BY_ID.get(templateId);
  return entry && (!kind || entry.kind === kind) ? entry : undefined;
}
export function getTemplatesByKind(kind: CosmeticKind): CosmeticTemplateEntry[] {
  return ALL.filter((entry) => entry.kind === kind);
}
export function cosmeticImage(templateId: number | null | undefined, kind: CosmeticKind): string {
  return (getCosmetic(templateId ?? DEFAULT_COSMETIC[kind], kind) ??
    getCosmetic(DEFAULT_COSMETIC[kind], kind))!.image;
}
export function isCosmeticUnlocked(entry: CosmeticTemplateEntry, level: number): boolean {
  return entry.soulbound || level >= entry.requiredLevel;
}
