# Shared ability medallions

18 active Diademfall ability icons and 6 retained retired illustrations. The manifest marks each icon with `active`; the current catalog controls which icons appear in the game. Every PNG is transparent RGBA at 150 x 152 pixels. The copper bevel, navy face and simplified ivory/silver symbols follow the cleaned rarity-emblem artwork. The exterior is transparent; the face is opaque.

The app reads these files through src/components/game/AbilityIcon.tsx. Ability names, rules, role categories and interactions come from src/game/catalog/abilities.ts. Icons also appear as live card overlays and do not require regenerating the 150 base card textures.

manifest.json records output paths and checksums. Exact built-in ImageGen edit prompts and the export recipe are in docs/ability-rebalance/icon-prompts.json. The local source-master records stay in the gitignored .asset-work/ability-copper-jobs folder. Transparent canvas padding is trimmed before proportional resizing; symbols are not stretched into ovals.

Re-export with scripts/export-ability-icons.ps1 -Manifest .asset-work/ability-copper-final.json. Verify production PNGs with scripts/verify-ability-icons.ps1. Review docs/ability-rebalance/icon-contact-sheet.png for production and 24/32-pixel display sizes.
