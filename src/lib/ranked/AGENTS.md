# Ranked and division chests

- Division chests: granted in SQL when a rating move crosses a division threshold (once per division per season, seed committed at grant); rolled in TS (src/game/chests.ts) against the reserve capped at 3 per rarity and settled by service-role open_division_chest, which re-checks that capped reserve and retries on change; reward cards come only from the Legionnaire reserve, whose remaining count is derived (reward_reserve_remaining) (why: provably fair, never mints outside the reserve).
