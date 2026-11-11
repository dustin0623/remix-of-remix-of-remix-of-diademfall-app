# Navigation emblems — final generation prompt

Tool: built-in image_gen, transparent_background: true. Three Splinterlands navigation PNGs (Play, Shop, Market) were supplied as style references only; no reference artwork is shipped in this project.

Use case: stylized-concept.
Asset type: production transparent PNG navigation sprite atlas for Vexaria, a fantasy bomber mining browser game.
Input images 1–3 are STYLE REFERENCES ONLY: study the bold compact fantasy heraldic silhouettes, restrained two-tone coloring, sharp cutout details, slightly irregular carved/inked edges. Create completely ORIGINAL designs for our game, not replicas of these reference symbols.

Generate ONE finished sprite atlas: landscape canvas exactly 2048 by 1024 pixels if possible, 2:1 aspect ratio, an invisible regular grid of FOUR equal square columns and TWO equal square rows. EIGHT individual icons, one per cell. Exact row-major order, which is critical for CSS:
TOP ROW left to right:
0 HEROES: a ranger's hooded helmet and broad shoulder mantle, emerald green with lighter jade cutout details; faceless bold hood silhouette, not a cute portrait.
1 HOUSE: a compact steep-roof timber miners' cottage, warm ochre with burnt amber details, simple door and chimney silhouette.
2 PLAY: a round bomber bomb with a short lit fuse above two crossed mining picks, vivid deep turquoise/teal with lighter teal carved highlights; strong recognizable silhouette.
3 FUSION: three faceted crystal shards merging above a small alchemical spiral, amethyst violet with restrained magenta highlights.
BOTTOM ROW left to right:
4 MARKET: balanced merchants' scales with a coin on one pan and a small rectangular hero card on the other, antique amber gold, a few lighter yellow cutouts.
5 LEADERBOARD: a victorious champion trophy cup framed by angular laurel leaves, rich gold with warm ochre secondary shading.
6 SHOP: a strapped wooden supply chest with a small coin purse leaning against it, bronze/golden yellow, a clear silhouette distinct from the Market scales.
7 BRAND: an original round bomb emblem with a crystalline star shaped fuse spark and two short wing-like explosive flourishes, warm gold/copper, no letters.

Visual style across ALL eight: flat fantasy heraldic game UI emblems, mostly single accent hue per icon with just one secondary tone, hard-edged solid shapes with purposeful transparent negative-space details, subtle hand-carved irregularity, almost screen-printed silhouettes. Broad shapes readable at 40–52 pixels. Front-facing orthographic emblems, same visual weight and occupied area. NOT glossy, NOT photoreal, NOT 3D miniatures, no thick black cartoon outlines, no realistic material textures, no chibi faces, no pastel kawaii look. Do not add surrounding round badges, shields, frames, discs or button plates; isolated glyphs only.

Layout constraints: every icon perfectly centered within its own 512x512 cell; each silhouette occupies about 76% of its cell width and height, with at least 12% clear transparent padding on EVERY side. No artwork crosses a cell boundary. No dividers or grid lines. Exactly eight glyphs, no extras, no text, no letters, no labels, no watermark, no scenes or shadows. Genuine transparent background throughout empty space, preserve alpha. Crisp professional game-ready edges. Output the atlas itself, not a preview mockup.
