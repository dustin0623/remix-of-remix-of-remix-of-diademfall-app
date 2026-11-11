import { describe, expect, it } from "vitest";
import { activityCsv, categoryOf, csvCell } from "./activity";

describe("currency activity", () => {
  it("groups deposits, withdrawals and refunds under transfers", () => {
    expect(categoryOf("usdc_deposit")).toBe("transfers");
    expect(categoryOf("withdrawal")).toBe("transfers");
    expect(categoryOf("withdrawal_refund")).toBe("transfers");
    expect(categoryOf("chest_credits")).toBe("rewards");
    expect(categoryOf("something_new")).toBe("other");
  });

  it("exports exact amounts and neutralises spreadsheet formulas", () => {
    expect(csvCell("-12.50000000")).toBe('"-12.50000000"');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    const csv = activityCsv([
      { id: "1", createdAt: "2026-11-11T00:00:00Z", currency: "coins", amount: "-3.00000001", balanceAfter: "0.5", entryType: "withdrawal", referenceType: "transfer", referenceId: "abc", metadata: {} },
    ]);
    expect(csv.split("\r\n")[1]).toBe('"2026-11-11T00:00:00Z","Withdrawal","Coins","-3.00000001","0.5","transfer:abc"');
  });
});
