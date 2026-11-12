import { writeFileSync } from "node:fs";
import { gameVersionTableSql } from "../src/game/sql-constants";
writeFileSync(
  "docs/ability-rebalance/game-version.sql",
  "-- Review proposal. Apply through Lovable in a new migration; no reset or data deletion.\n" +
    gameVersionTableSql() +
    "\n",
);
writeFileSync(
  "docs/ability-rebalance/lovable-handoff.md",
  [
    "# Lovable Cloud handoff",
    "",
    "Keep existing accounts, card IDs, inventory, balances, packs and seasons.",
    "",
    "1. Add a new migration containing the exact generated public.game_version_table() definition in game-version.sql. Keep the existing active version name; update its catalog hash. Do not drop tables or reset data.",
    "2. Run the existing scripts/load-catalog.ts loader with the project's managed service credentials to synchronize current card metadata and summoner mana/effects. Do not grant cards or change ownership.",
    "3. Verify the game_version_table consistency test, catalog card count (138 active), and a ranked practice/test flow.",
    "",
    "The repository's AGENTS.md says: Database. Do not add or edit supabase/migrations/ or drizzle/. Ask Lovable to change the schema. No migration directory or live database was edited by this task.",
    "",
    "The 150 image assets include 12 illustrations outside the currently playable roster. Artwork availability does not make those cards draftable.",
    "",
  ].join("\n"),
);
