# Layered regular card artwork

This folder contains 150 original character textures at exactly 300 x 420. There are 138 currently playable cards; 12 additional summoner illustrations remain as artwork.

Layout: {banner}/{rarity}/{summoner-or-normal}/regular_{catalog_id}.png

Raw transparent portraits, transparent rarity frames and patterned backdrops live separately under public/assets/raw. Final textures layer those assets with a banner crest and empty mana badge. Names, live stat values, levels and abilities are rendered by the app.

Every rarity uses the same silver frame with sharp square outer corners, simple inner-corner accents and a continuous top rail. Only the cleaned flame color changes: white, green, blue, purple or ember. Frame artwork matches the game's crests and characters.

The existing manifest retains original generation prompts and source checksums, and records the final canvas, texture checksum and layer paths. Gold foil assets are not part of this pass.

Rebuild: ./scripts/compose-card-assets.ps1 -RequireAll
QA: ./scripts/review-card-cutouts.ps1 -RequireAll

See docs/card-layers/README.md for the production workflow and reference notes.
