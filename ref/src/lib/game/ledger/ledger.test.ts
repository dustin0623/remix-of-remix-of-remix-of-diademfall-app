import { describe, expect, it } from "vitest";
import { ledgerSince, ledgerStatus, LEDGER_PAGE_SIZE, isLedgerTab, isLedgerRange } from "./ledger";

describe("ledger rules", () => {
  it("starts Today at the player's local midnight", () => {
    expect(ledgerSince("today", new Date("2026-11-08T15:49:00Z"), -480)?.toISOString()).toBe("2026-11-07T16:00:00.000Z");
    expect(ledgerSince("today", new Date("2026-11-08T15:49:00Z"), 300)?.toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });
  it("uses rolling 7-day and 30-day windows and no all-time cutoff", () => {
    const now = new Date("2026-11-08T15:49:00Z");
    expect(ledgerSince("7days", now)?.toISOString()).toBe("2026-11-01T15:49:00.000Z");
    expect(ledgerSince("30days", now)?.toISOString()).toBe("2026-10-09T15:49:00.000Z");
    expect(ledgerSince("all", now)).toBeNull();
  });
  it("uses the real withdrawal queue outcome instead of the stored processing status", () => {
    expect(ledgerStatus("processing", "completed")).toBe("completed");
    expect(ledgerStatus("processing", "FAILED")).toBe("failed");
    expect(ledgerStatus("completed", "PENDING")).toBe("processing");
    expect(ledgerStatus("processing", "PROCESSING")).toBe("processing");
  });
  it("accepts only known filters and limits each requested page to 30 records", () => {
    expect(isLedgerTab("economy")).toBe(true);
    expect(isLedgerTab("other-player")).toBe(false);
    expect(isLedgerRange("all")).toBe(true);
    expect(isLedgerRange("tomorrow")).toBe(false);
    expect(LEDGER_PAGE_SIZE).toBe(30);
  });
});