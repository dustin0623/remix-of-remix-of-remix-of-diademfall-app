# Diademfall illustration revision

Created with the built-in `image_gen` tool on 12 November 2026. Reviewed Splinterlands Rebellion character rendering through the user's collection: Blackmoor Wild Elf, Commander Slade, and Drybone Hobgoblin. The reference informed rendering traits; these are original Diademfall designs, not extracted or republished Splinterlands images.

## Direction

- Bold dark contours and broad, angular silhouettes.
- Expressive heroic anatomy and readable faces.
- Saturated jewel colors, two-to-three-tone cel shading, controlled highlights.
- Simplified graphic environments with depth and space for interface overlays.
- No baked-in card frames, decorative borders, names, numbers, stats, badges, UI, logos, or watermarks.

## Delivered set

- `characters/`: six faction representatives and a neutral Wayfarer.
- `editions/`: Ancient, Oath, and Legionnaire character illustrations. These replace the former packaging art for this artwork-only pass.
- `backgrounds/`: home realm, camp, arena, and summoning gate.
- PNG files are generated masters; matching JPEG files are quality-90 web exports at the same dimensions. Compression does not change composition.
- `manifest.json` records all 14 assets and the full final generation prompts. Subsequent generations use the new Bastion illustration as a style reference.
- `/artwork.html` provides an unframed review gallery with original-size links.

## Integration and limits

Active image paths are centralized in `src/lib/artwork.ts` for TypeScript consumers. Static CSS and painted hero sections use the matching public background URLs. Existing logo and navigation icons remain interface assets. Previous illustrations remain in the repository as inactive legacy assets.

This revision covers the existing shared asset set, as selected by the user. Cards still share faction illustrations; unique art for all 150 catalog cards is a separate pass. The image files contain no frames. Existing application components continue to provide their functional labels, selection states, and card information in HTML.
