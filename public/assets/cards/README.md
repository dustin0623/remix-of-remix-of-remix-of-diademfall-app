# Individual regular card artwork

Created with the built-in ImageGen tool. The roster contains 30 summoners and 120 troops, including 12 neutral Wayfarers. Progress and exact prompts are recorded per card in `manifest.json`.

## Layout

`{banner}/{rarity}/{summoner|normal}/regular_{catalog_id}.png`

- Banner folders use catalog identifiers: `bastion_orders`, `wild_courts`, `veil_covenant`, `hollow_legions`, `skybound_houses`, `wyrm_clans`, and neutral `wayfarer`.
- Rarity folders: `common`, `uncommon`, `rare`, `epic`, `legendary`.
- Summoners use `summoner`; all troops and creatures use `normal`.
- Catalog IDs are normalized lowercase card names with underscores. Example: `bastion_orders/rare/summoner/regular_aldric_stonebanner.png`.
- `gold_{catalog_id}.png` is reserved for the future foil pass. No gold images are generated here.

## Artwork

Every PNG is a distinct, original, unframed character illustration with a supporting background. The visual direction uses bold dark contours, saturated faction palettes, expressive silhouettes and clean cel shading, consistent with the prior Diademfall revision. It contains no baked-in text, stats, logos, UI, decorative frame or foil effect. Creature subjects keep their animal or construct identity.

Generated files are copied into this folder as soon as they finish. The recording helper verifies PNG signatures, dimensions and checksums. Pending entries in the manifest are not complete artwork. The app's lightweight index references completed images and falls back to shared faction art while generation is underway.

## Production files

- `scripts/card-art-briefs.ts`: unique subject brief for every catalog card.
- `scripts/prepare-card-art.ts`: catalog-derived prompts, folder layout and resumable manifest.
- `scripts/record-card-art.mjs`: validates and saves each built-in generation result.
- `src/lib/card-art.ts`: regular artwork resolver and future regular/gold path convention.
- `/card-art.html`: artwork-only review gallery.
