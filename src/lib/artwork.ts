/** Original, unframed illustrations. Masters and generation prompts live beside the web exports. */
const root = "/assets/rebellion";

export const ARTWORK = {
  characters: {
    bastion_orders: `${root}/characters/bastion_orders.jpg`,
    wild_courts: `${root}/characters/wild_courts.jpg`,
    veil_covenant: `${root}/characters/veil_covenant.jpg`,
    hollow_legions: `${root}/characters/hollow_legions.jpg`,
    skybound_houses: `${root}/characters/skybound_houses.jpg`,
    wyrm_clans: `${root}/characters/wyrm_clans.jpg`,
    wayfarers: `${root}/characters/wayfarers.jpg`,
  },
  backgrounds: {
    hero: `${root}/backgrounds/hero.jpg`,
    camp: `${root}/backgrounds/camp.jpg`,
    arena: `${root}/backgrounds/arena.jpg`,
    gate: `${root}/backgrounds/gate.jpg`,
  },
  editions: {
    ancient: `${root}/editions/ancient.jpg`,
    oath: `${root}/editions/oath.jpg`,
    legionnaire: `${root}/editions/legionnaire.jpg`,
  },
} as const;
