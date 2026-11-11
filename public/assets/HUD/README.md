# HUD artwork

Generated with the built-in imagegen tool. The application uses `navigation-atlas-v3.png` through `HudIcon.tsx` and `crown-logo-v1.png` in the navbar. See [NAVIGATION-V3.md](./NAVIGATION-V3.md) for the active assets and their exact generation prompts. Earlier atlases and the original Diademfall wordmark are preserved.

Grid: 4 columns × 2 rows. Top row: practice, ranked, ladder, shop. Bottom row: market, treasury, codex, credits.

Generation prompt:
Create one transparent 4×2 fantasy game HUD sprite atlas: crossed silver swords with teal grips; bronze/gold shield with ruby; gold crown with blue jewels; leather card pack with amber seal; merchant balance scale; gold coin pile; open violet spellbook with cyan runes; turquoise crystal with gold mount. Polished hand-painted inventory art, chunky bevels, rich dark outlines, warm gold rims, bold silhouettes, warm top-left light. Equal square cells, centered objects, transparent padding, no labels, text, tile backgrounds, or borders. Icons must read at 32px.

Refinement prompt:
Remove all pale background pixels and drop shadows around the eight objects. Keep the layout, colors, scale, and positions. Preserve opaque painted objects with antialiased edges and zero-alpha corners and gutters for use on dark navy.

Existing logo copied from src/assets/portal/logo.png. Existing painted backgrounds are copied to ../home and ../battle for the redesigned pages.
