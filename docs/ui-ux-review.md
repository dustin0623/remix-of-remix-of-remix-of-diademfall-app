# Diademfall UI/UX review

Reviewed 12 November 2026 against the user's signed-in Splinterlands browser session and the Diademfall source.

## Reference patterns

The reviewed reference screens were the battle hub and history, rewards dashboard, collector, Items menu, card market, Open menu, Shop menu, and pack catalog. No purchases, claims, account changes, or ranked battles were performed.

| Pattern | Diademfall implementation |
| --- | --- |
| Persistent icon navigation with a stable economy loop | Play, Shop, Market, Open, Cards, and Codex remain discoverable when logged out; protected routes preserve their destination through sign-in. Realm contains leaderboard, treasury, wallet, and activity. |
| Battle action as the center of the experience | The home War Room puts Practice or Ranked beside a division summary, with links into collection building. The existing ranked lobby retains energy, reward progress, matchmaking, and dashboard sections. |
| Clear onboarding from practice to collection to ranked | Three actionable steps on the home hub; an in-context handbook explains mana, Banners, attack types, and formation. |
| Card-first browsing with persistent controls | The Codex supports name/ability search, Banner, rarity, edition, mana, sorting, result counts, and reset/empty states. Card inspection previews troop levels and their unlocked abilities. |
| Consistent economy navigation | Pack Shop, Card Market, Open, and Collection share the same subnavigation. Pack tiles explain guaranteed rarity and supply availability; insufficient Credits link to the wallet. |
| Useful match history | Recent results summary, win/loss/draw filtering, empty guidance, and a retry state when history fails. |
| Formation as an explicit draft step | Formation count, readable controls, boundary-disabled reorder actions, troop search, and a compact mobile jump to the formation panel. |

## Visual direction

Keep Diademfall's painted artwork, six Banners, crown insignia, gold typography, and dark navy panels. Use emerald for the primary battle action and teal for active states. Reuse the existing local artwork and icon atlas; no Splinterlands artwork is copied. Additional generated artwork was unnecessary for these screens.

## Scope

This pass changes presentation and navigation. Game simulation, card ownership, economy procedures, authentication, database schemas, and chance-roll algorithms retain their existing implementations. Features such as guilds, land, and social feeds are not added merely because they appear in the reference. The existing Challenge dialog continues to describe its availability.

Signed-out browser checks cover the War Room, handbook, Codex, card inspection, practice drafting, and sign-in redirects. Authenticated data and transaction flows require a signed-in Diademfall session for full end-to-end verification; inspecting the signed-in Splinterlands reference does not grant that access.

## Verification

- TypeScript check and production build passed.
- Existing suite: 26 files, 229 tests passed. The routing test also passed after the final sign-in refinements.
- Browser checks confirmed combined card filters, search/reset/empty states, level-dependent stats and abilities, handbook opening/closing, troop search, formation reordering, and the collection destination surviving a sign-in redirect.
- Desktop and 390px mobile viewport checks completed. The home hub, Codex, and practice draft had no horizontal overflow; footer wrapping was corrected during this check.
- The original Bun lockfile was preserved. A pnpm-triggered dependency setup was repaired with a full frozen-lockfile Bun reinstall; the local preview was restarted and verified without new browser console errors.
