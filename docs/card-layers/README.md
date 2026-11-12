# Diademfall card layers

The 150 existing character illustrations were preserved and edited with built-in ImageGen to remove their environments. The playable catalog currently contains 138 cards; the extra 12 illustrations remain available without becoming draftable.

## Production layout

| Asset | Folder | Canvas |
|---|---|---|
| Transparent portraits | public/assets/raw/portraits/{banner}/{rarity}/{normal-or-summoner}/{id}.png | 300 x 420 |
| Transparent rarity frames | public/assets/raw/frames/{rarity}.png | 300 x 420 |
| Flat heraldic backgrounds | public/assets/raw/frames-background/{banner}.png | 300 x 420 |
| Layered card textures | public/assets/cards/{banner}/{rarity}/{normal-or-summoner}/regular_{id}.png | 300 x 420 |
| Stat overlay badges | public/assets/stats/{stat}.png | 96 x 96 |
| Banner/Wayfarer crests | public/assets/banners/crests/{banner}.png | 96 x 96 |
| Shared ability medallions | public/assets/abilities/{ability}.png | 150 x 152 |

Portraits fit the shared canvas without stretching or cropping their proportions. Frames have transparent portrait windows and exterior corner cutouts. Backgrounds are opaque, deliberately simple patterns.

The final PNG layers are background, portrait, lower readability shade, frame, banner crest, and empty mana badge. The application adds names, current stat values, level, and unlocked abilities as live overlays. Level changes therefore do not require another texture.

## Frame correction

The top rail is flat, continuous, and flush with the canvas. The circular rarity seal is recessed below the rail. No raised gem or exposed artwork strip sits above the top edge.

The flame seals follow the user's supplied card-silver, card-emerald, card-cyan, card-magenta, and card-amber 300x420 frames. Only their flame medallions are referenced; the wood ribbon and lower panel are not included. Every rarity uses the exact same silver frame. Only the inner flame seal changes: white/common, green/uncommon, blue/rare, purple/epic, and ember/legendary. The upper corners now use clean chamfered joins matching the bottom, with no outward hooks. ImageGen created the edits; the exporter clips each colored seal onto the shared silver master so all pixels outside the seal remain identical.

Frame QA samples seven columns across the top rail, verifies opacity within the first eight pixels and a transparent central window, and compares all pixels outside the inner seal to the silver common frame. Exact results are in frame-qa.json.

## Banner crest housing

All six banner crests and the neutral Wayfarer crest now use a broad silver shield housing inspired by the Wyrm Clan outline. The housing has arched shoulders, tapered sides, one lower point, a bright silver bevel and a dark inner keyline. At the 96 x 96 production size, the rim is roughly 5–6 pixels thick so it remains visible in the 39-pixel card overlay.

Each banner retains its own symbol and field color. Antlers, leaves and wings stay inside the rim. All seven images have transparent exteriors and an opaque inner field. The shared renderer already uses these files, and all 150 final card textures were recomposed with the new shields.

Production files are public/assets/banners/crests/{banner}.png. Built-in ImageGen edit prompts are in public/assets/raw/layers-manifest.json. The contact sheet and native card-corner crops are in silver-shield-crests.png; dimensions, alpha checks and checksums are in crest-qa.json.

## Sources and inspiration

The /ref collection renderer supplied the separation of artwork from stats, skills, name and level overlays. Its code and assets are not imported by the application.

The user's open Splinterlands Rebellion market provided the 300 x 420 proportions and the presentation reference: dominant character cutout, simple repeated backdrop, narrow rim, edge stat badges, and ability icons near the bottom. Diademfall portraits, frames, backgrounds, crests and stat badges are original artwork. The rarity flame motif comes from the user's supplied reference frames.

## Rebuild and verification

- Recompose all final textures: ./scripts/compose-card-assets.ps1 -RequireAll
- Inspect alpha and dimensions: ./scripts/review-card-cutouts.ps1 -RequireAll
- Inspect crest alpha and native card corners: ./scripts/review-card-crests.ps1
- Import an ImageGen portrait master: scripts/export-card-portrait.ps1
- Re-export newly generated frame/stat/crest/background masters: scripts/export-card-layers.ps1 (requires local generation records)
- Exact layer prompts: public/assets/raw/layers-manifest.json
- Exact portrait prompt template and per-card mapping: public/assets/raw/portraits/manifest.json
- Card texture dimensions, checksums and layer paths: public/assets/cards/manifest.json
- Original full-resolution source backups remain locally in the gitignored .asset-work/originals folder.

The compositor uses the committed raw layers and does not call a model or access the network. Original generation prompts are kept as provenance; raw masters should not be copied directly over final layered textures.

## UI checks

The Codex, card inspector, and shared game card renderer use the same 5:7 geometry. Desktop and 390-pixel phone checks before the final corner revision verified alignment, search, role filtering, and changing a card level to reveal Brace. The final silver-only corner revision was checked in the exported assets; browser access was unavailable in the continuation chat. The phone inspector scrolls when its complete 300 x 420 card and details exceed the viewport.
