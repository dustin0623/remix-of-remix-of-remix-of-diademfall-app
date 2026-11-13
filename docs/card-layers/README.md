# Diademfall card layers

The 150 existing character illustrations were preserved and edited with built-in ImageGen to remove their environments. The playable catalog currently contains 138 cards; the extra 12 illustrations remain available without becoming draftable.

## Production layout

| Asset | Folder | Canvas |
|---|---|---|
| Transparent portraits | public/assets/raw/portraits/{banner}/{rarity}/{normal-or-summoner}/{id}.png | 300 x 420 |
| Transparent rarity frames | public/assets/raw/frames/{rarity}.png | 300 x 420 |
| Cleaned flame rarity emblems | public/assets/raw/rarity-emblems/{rarity}.png | 96 x 96 |
| Flat heraldic backgrounds | public/assets/raw/frames-background/{banner}.png | 300 x 420 |
| Layered card textures | public/assets/cards/{banner}/{rarity}/{normal-or-summoner}/regular_{id}.png | 300 x 420 |
| Stat overlay badges | public/assets/stats/{stat}.png | 96 x 96 |
| Banner/Wayfarer crests | public/assets/banners/crests/{banner}.png | 96 x 96 |
| Shared ability medallions | public/assets/abilities/{ability}.png | 150 x 152 |

Portraits fit the shared canvas without stretching or cropping their proportions. Frames have transparent portrait windows and square outer corners. Backgrounds are opaque, deliberately simple patterns.

The final PNG layers are background, portrait, lower readability shade, frame, banner crest, and empty mana badge. The application adds names, current stat values, level, and unlocked abilities as live overlays. Level changes therefore do not require another texture.

## Frame artwork and rarity

All five rarities share the same narrow silver frame with sharp square outer corners, a continuous flat top rail, and a recessed rarity seal. The frame uses bold dark outlines and broad silver/ivory, blue-gray and navy cel-shaded planes to match Diademfall's own crests and characters. Small original folded-angle accents decorate the inner corners; the supplied Splinterlands image is layout inspiration only.

The flame rarity symbol is retained and redrawn with broad tongues and a single clean cutout. White/common, green/uncommon, blue/rare, purple/epic and ember/legendary flames sit on a dark face. The complete 96 x 96 emblem exports live under public/assets/raw/rarity-emblems. The exporter composites only their inner faces into the shared frame, so all frame pixels outside the seal remain identical.

Frame QA checks the top rail, square corners, transparent portrait window and identical silver artwork outside the seal. Dimensions, alpha checks and checksums are recorded with the asset previews. Exact frame-base and emblem prompts are retained in public/assets/raw/layers-manifest.json.

## Banner crest housing

All six banner crests and the neutral Wayfarer crest now use a broad silver shield housing inspired by the Wyrm Clan outline. The housing has arched shoulders, tapered sides, one lower point, a bright silver bevel and a dark inner keyline. At the 96 x 96 production size, the rim is roughly 5–6 pixels thick so it remains visible in the 39-pixel card overlay.

Each banner retains its own symbol and field color. Antlers, leaves and wings stay inside the rim. All seven images have transparent exteriors and an opaque inner field. The shared renderer already uses these files, and all 150 final card textures were recomposed with the new shields.

Production files are public/assets/banners/crests/{banner}.png. Built-in ImageGen edit prompts are in public/assets/raw/layers-manifest.json. The contact sheet and native card-corner crops are in silver-shield-crests.png; dimensions, alpha checks and checksums are in crest-qa.json.

## Stat symbols and card overlays

The stat assets use the same bold outlines, silver edges and simple cel shading as the crests. Mana is a blue crystal, health a red heart, armor a plain shield, speed a blue boot, melee (steel) two crossed swords, ranged (shot) a bullseye, and magic (spell) a violet spark with teal trails. Numbers remain live overlays; the boot and crossed-sword values have small alignment offsets.

The banner text below the name is removed. The level/effect row and ability tray share a footer; flex layout centers the abilities in the remaining space above the bottom frame. Gaps between ability icons are doubled. Side combat-stat badges extend one-third of their width beyond the card edge, with Codex grid gutters reserving room for the outsets.

## Sources and inspiration

The /ref collection renderer supplied the separation of artwork from stats, skills, name and level overlays. Its code and assets are not imported by the application.

The user's open Splinterlands Rebellion market provided the 300 x 420 proportions and the presentation reference: dominant character cutout, simple repeated backdrop, narrow rim, edge stat badges, and ability icons near the bottom. Diademfall portraits, frames, backgrounds, crests and stat badges are original artwork. The rarity flame motif comes from the user's supplied reference frames.

## Rebuild and verification

- Recompose all final textures: ./scripts/compose-card-assets.ps1 -RequireAll
- Inspect alpha and dimensions: ./scripts/review-card-cutouts.ps1 -RequireAll
- Inspect crest alpha and native card corners: ./scripts/review-card-crests.ps1
- Inspect stat alpha, dimensions and small-value overlays: ./scripts/review-card-stats.ps1
- Import an ImageGen portrait master: scripts/export-card-portrait.ps1
- Re-export newly generated frame/stat/crest/background masters: scripts/export-card-layers.ps1 (requires local generation records)
- Exact layer prompts: public/assets/raw/layers-manifest.json
- Exact portrait prompt template and per-card mapping: public/assets/raw/portraits/manifest.json
- Card texture dimensions, checksums and layer paths: public/assets/cards/manifest.json
- Original full-resolution source backups remain locally in the gitignored .asset-work/originals folder.

The compositor uses the committed raw layers and does not call a model or access the network. Original generation prompts are kept as provenance; raw masters should not be copied directly over final layered textures.

## UI checks

The Codex, card inspector, and shared game card renderer use the same 5:7 geometry. The final frame was checked live on desktop and at a 390-pixel phone viewport. Square corners render without clipping, the banner subtitle is absent, the ability tray has equal space above and below its icons, and side stats extend one-third beyond the edge. The phone page has no horizontal content overflow. Screenshots are card-layout-desktop.jpg and card-layout-mobile.jpg; measured layout values are in card-layout-qa.json. Earlier interaction checks covered search, role filtering and changing a card level to reveal Brace.
