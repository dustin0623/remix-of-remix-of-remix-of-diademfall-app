# Navigation atlas v2

Generated using the built-in imagegen tool. Active asset: `navigation-atlas-v2.png`.
The previous atlases remain available as earlier versions.

Grid: 4 columns × 3 rows. Positions are defined in `src/components/portal/HudIcon.tsx`.

## Final generation prompt

Use case: stylized-concept.
Asset type: NEW fantasy card game navigation sprite atlas, one transparent PNG, exactly FOUR columns by THREE rows, equal square cells, canvas 1536 by 1152 (4:3).
Primary request: Create twelve original cohesive navigation icons with the visual simplicity and rich colors of a polished fantasy card battle game HUD. Broad strong silhouettes, painted dimensional shapes, restrained bevels, dark outlines, soft brushwork, cel-shaded highlights. Readable at 28px. Less ornate gold decoration than jewelry-like RPG inventory art. Color coded motifs, bright top edge lighting, muted shaded lower edges.
Exact grid order left to right:
Row 1: PLAY: teal armored clenched gauntlet; SHOP: warm brown satchel overflowing with gold coins; MARKET: violet mystical marketplace arch with little scales; LADDER: emerald heraldic banner with a small gold crown.
Row 2: TREASURY: amber pile of gold coins; CODEX: blue and violet open spellbook; RANKED: bronze circular league medal with a subtle crown center; PRACTICE: silver and blue heraldic shield.
Row 3: CHALLENGE: two crossed orange-gold swords; CREDITS: luminous turquoise faceted crystal; COLLECTION: three fanned fantasy cards; REWARDS: small wooden gold-trimmed treasure chest glowing cyan.
Composition: each object centered in its own cell with identical scale and at least 15% transparent padding on all sides, no objects touch cell edges. No overlapping cells. No backgrounds, tiles, circles behind icons, text, letters, labels, watermark, grid lines, shadows outside icons, or border around atlas.
Critical transparency: ALL pixels outside painted object contours, including ALL corners, gutters, and negative space, must have alpha zero. Do not render gray/white checkerboards or semitransparent fog. It must look clean on a dark navy navbar.
