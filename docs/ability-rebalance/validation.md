# Ability revision validation — 12 November 2026

- Compared the user's open Exemplar selector with all 24 current abilities, then checked official ability categories, status interactions, Impede and card-stat documentation. Research and rationale: splinterlands-comparison.md.
- Regenerated all 24 icons using built-in ImageGen. Exported exactly 150 x 152, preserving transparency and circular proportions. All 24 files pass corner-alpha, center-alpha, dimension, aspect-ratio and SHA-256 checks in icon-qa.json. The production-size and 24/32-pixel contact sheet was visually reviewed.
- Full suite: 259 tests, 258 passed. The only failure is the existing SQL game_version_table fingerprint guard, which awaits Lovable's migration. No tests were skipped or weakened to suppress it.
- The final 35 ability interaction tests pass, covering targeting, cadence, mitigation, restoration, debuffs, expiry and stacking. The earlier broader focused engine/roster run passed 66 tests. The extra Crosswind-expiry fixture was added after the full suite and passed in the final focused rerun.
- Production build and TypeScript check passed. Build output is regenerated after the final asset export.
- Matched before/after samples use 5,400 battles per engine, all 15 banner pairs, both sides, three mana caps and three level stages. Fresh validation uses another 5,400 battles on seeds 30001–30020. See simplification-balance-summary.json and the raw reports. Mid-level Veil Covenant remains weak on fresh seeds; this is an AI diagnostic, not metagame certification.
- The initial Splinterlands tab was inspected read-only. Final live Codex access became unavailable in the continuation chat. Final icons were checked directly in their contact sheet; the UI uses the same stable asset paths and current catalog descriptions.

The final generated SQL proposal and Cloud handoff are refreshed. Database migrations, live ownership, balances and player accounts were not edited. No database reset was performed.
