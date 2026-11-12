import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SUMMONERS } from "../src/game/catalog/summoners";
import { TROOPS } from "../src/game/catalog/troops";
import { CARD_ART_BRIEFS } from "./card-art-briefs";

const artRoot = join(process.cwd(), "public", "assets", "cards");
const manifestPath = join(artRoot, "manifest.json");
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const previousById = new Map((previous?.cards ?? []).map((c: { id: string }) => [c.id, c]));
const factionStyle: Record<string, string> = {
  bastion_orders: "Cobalt blue, ivory, warm gold; lawful fortress guards, masons, knights and retainers. Angular pale-stone fortress background.",
  wild_courts: "Emerald, moss, ivory and amber; beasts, living plants, forest folk and druids. Broad leafy forest shapes and moonlight.",
  veil_covenant: "Violet, plum, turquoise and ivory; fey, mirrors, silk, paper and lacquer. Abstract mirror-shard and flowing-ribbon backdrop.",
  hollow_legions: "Plum, bone ivory, jade and dull bronze; non-gory undead and ghost magic. Graphic ruined arches and jade moonlight.",
  skybound_houses: "Cyan, ivory, indigo and warm gold; birds, griffins, cliff folk and wind magic. Open cloud shapes and floating cliff towers.",
  wyrm_clans: "Crimson, charcoal, amber and bronze; dragons, kobolds, drakes and ancestral fire. Angular volcanic stone and ember shapes.",
  wayfarer: "Ochre, muted teal, bronze and cream; independent travelers and creatures without faction heraldry. Open road and weathered ruin shapes.",
};
const roster = [...SUMMONERS, ...TROOPS];
const cards = roster.map(card => {
  const brief = CARD_ART_BRIEFS[card.id];
  if (!brief) throw new Error(`Missing unique art brief: ${card.id}`);
  const banner = card.banner ?? "wayfarer";
  const kind = card.cardType === "summoner" ? "summoner" : "normal";
  const file = `/assets/cards/${banner}/${card.rarity}/${kind}/regular_${card.id}.png`;
  const reference = `/assets/rebellion/characters/${banner === "wayfarer" ? "wayfarers" : banner}.png`;
  const prompt = [
    "Use case: stylized-concept. Deliver ONE original Diademfall character illustration, portrait 3:4, full-bleed edge-to-edge artwork, production quality.",
    "Image 1 is a STYLE REFERENCE ONLY. Match its confident dark ink contours, broad angular shapes, expressive heroic anatomy, clean 2-3 tone cel shading, saturated jewel colors and crisp controlled highlights. Create the NEW requested character, not the reference character. No photorealism, 3D rendering, painterly blur or dense microtexture.",
    `Subject: ${card.name}. ${brief}`,
    `Faction art direction: ${factionStyle[banner]}`,
    `Card identity: ${kind === "summoner" ? "a commanding summoner with distinct personality" : "a distinct troop or creature"}; ${card.rarity} rarity. ${card.rarity === "legendary" ? "Monumental dramatic presence, controlled magical atmosphere." : card.rarity === "epic" ? "Elite silhouette and striking distinctive equipment or anatomy." : "Readable original silhouette, deliberate simple supporting background."}`,
    "Composition: one dominant character or creature. Expressive face, eyes, or equivalent focal point near upper center. For humanoids show head to knees, keep face, hands, and primary prop clear inside canvas; for animals and small creatures show the whole body. Do not humanize animal species. Keep the subject recognizable at thumbnail size. Leave a little breathing room around horns, ears and wings. Supporting environment remains secondary.",
    "ABSOLUTE REQUIREMENTS: JUST CHARACTER AND BACKGROUND. NO card frames, borders, decorative corners, labels, writing, names, letters, numbers, stats, mana symbols, badges, logos, UI, signature, watermark or gold-foil treatment. This is regular artwork only. No collage, multiple panels, contact sheet or product mockup. Do not copy an existing Splinterlands character.",
  ].join("\n");
  mkdirSync(join(process.cwd(), "public", file.slice(1), ".."), { recursive: true });
  const old = previousById.get(card.id) as Record<string, unknown> | undefined;
  const saved = existsSync(join(process.cwd(), "public", file.slice(1)));
  return { id: card.id, name: card.name, banner, rarity: card.rarity, kind, file, reference, prompt, status: saved ? (old?.["status"] ?? "generated") : "pending", ...(saved && old?.["sha256"] ? { sha256: old["sha256"], width: old["width"], height: old["height"] } : {}) };
});
if (new Set(cards.map(c => c.file)).size !== roster.length) throw new Error("Duplicate card-art output path");
writeFileSync(manifestPath, JSON.stringify({ version: 1, generator: "built-in image_gen", naming: "/assets/cards/{banner}/{rarity}/{summoner|normal}/regular_{catalog_id}.png", goldFoil: "Reserved for a later gold_{catalog_id}.png pass; no gold assets generated here.", cards }, null, 2) + "\n");
console.log(JSON.stringify({ total: cards.length, pending: cards.filter(c => c.status === "pending").length, generated: cards.filter(c => c.status !== "pending").length, manifest: manifestPath }));
