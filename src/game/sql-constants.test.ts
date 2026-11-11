import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SQL_CONSTANT_FUNCTIONS } from "./sql-constants";

const dir = path.resolve(__dirname, "../../drizzle/migrations");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Newest migration that (re)defines public.<name>(); null when none does. */
function latestDefinition(name: string): string | null {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let found: string | null = null;
  for (const f of files) {
    const sql = readFileSync(path.join(dir, f), "utf8");
    if (sql.includes(`FUNCTION public.${name}()`)) found = sql;
  }
  return found;
}

describe("SQL constant functions match the TS game constants", () => {
  for (const [name, generate] of Object.entries(SQL_CONSTANT_FUNCTIONS)) {
    it(`${name}() in the newest migration equals the generated SQL`, () => {
      const sql = latestDefinition(name);
      // A remix starts with an empty migration set; the database then keeps the copied function.
      if (sql === null) return;
      expect(squash(sql)).toContain(squash(generate()));
    });
  }

  it("ranked divisions: Silver II rolls 2 rules and grants 1 War + 2 Scout chests; Wood resets to 0", () => {
    const sql = SQL_CONSTANT_FUNCTIONS.ranked_division_table();
    expect(sql).toContain("('silver_ii', 'silver', 2, 1535, 2, 'war', 1, 'scout', 2, 1000)");
    expect(sql).toContain("('wood', 'wood', NULL, 0, 0, NULL, 0, NULL, 0, 0)");
  });

  it("Card Essence: Common Regular level 10 needs 46 CE, Legendary Gold level 3 needs 3 CE", () => {
    const sql = SQL_CONSTANT_FUNCTIONS.card_level_requirement_table();
    expect(sql).toContain("('common', 'regular', 10, 46)");
    expect(sql).toContain("('legendary', 'gold', 3, 3)");
  });

  it("ranked rule pool excludes the Open Chronicle baseline and keeps clashes", () => {
    const sql = SQL_CONSTANT_FUNCTIONS.ranked_ruleset_pool();
    expect(sql).not.toContain("'open_chronicle'");
    expect(sql).toContain("('closed_ranks', 100, '{open_contract}')");
  });
});
