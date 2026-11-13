# Shared raw card layers

Portraits, frames and frames-background are all 300 x 420 and align on one canvas. Portraits and frame windows preserve alpha transparency. Patterned backgrounds are intentionally opaque.

Six banner crests plus a neutral Wayfarer crest are in public/assets/banners/crests. Each crest has a broad silver shield rim, a dark inner edge, its own colored field and a transparent exterior. Seven stat badges are in public/assets/stats. The application overlays current values; they are not baked into the portraits.

The five frames share sharp square silver outer edges, simple original inner-corner accents, and cleaned flame rarity seals. Only the flame color changes by rarity. Separate emblem exports are in public/assets/raw/rarity-emblems.

The exact frame, pattern, stat and crest prompts are in layers-manifest.json. Portrait edit provenance is in portraits/manifest.json. All creative generation and background extraction used the built-in ImageGen tool.
