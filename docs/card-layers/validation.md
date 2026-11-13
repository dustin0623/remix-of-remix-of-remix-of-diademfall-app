# Validation — 12 November 2026

- All 150 transparent portraits: 300 x 420, nonempty alpha, visually reviewed on six checkerboard sheets.
- All 150 final layered textures: 300 x 420, every referenced layer exists, checksums match the card manifest.
- Five frames: transparent central window, complete top rail, square outer corners and zero differing pixels outside the inner rarity seal. Frame artwork uses bold outlines, simple silver cel shading and original inner-corner accents.
- Five cleaned flame rarity emblems: 96 x 96 transparent PNGs, exported separately and composited into the shared frame. See rarity-emblem-qa.json.
- 24 ability medallions: transparent PNG, 150 x 152.
- Seven stat badges and seven banner/Wayfarer crests: 96 x 96 transparent PNGs.
- Crest revision: all seven use a broad silver shield housing. Their transparent exteriors and opaque fields pass export checks. Native 39-pixel card corners were reviewed in silver-shield-crests.png after rebuilding all 150 textures.
- Production build and TypeScript check passed. Targeted lint reported no errors; the existing component/helper Fast Refresh warning remains in cards.tsx.
- Full test run: 250 passed, two failed. The AI-dependent Field Ration smoke test was replaced with a controlled formation and its complete 15-test Wayfarer suite passed on rerun. The remaining failure is the unchanged SQL catalog-hash consistency guard pending the Lovable migration.
- Final live checks passed on desktop and a 390-pixel phone viewport. Abilities have equal top/bottom padding in the footer; side stats extend one-third beyond the card edges. No banner subtitle or horizontal phone overflow is present. Screenshots and measured geometry are saved beside this document. The temporary phone viewport override was cleared.

Raw assets and prompt provenance are saved under public/assets/raw. Rebuild the final textures with scripts/compose-card-assets.ps1 -RequireAll; rerun scripts/verify-card-assets.ps1 and scripts/review-card-cutouts.ps1 -RequireAll for asset checks. The Cloud catalog update is described in docs/ability-rebalance/lovable-handoff.md; no database reset is required.
