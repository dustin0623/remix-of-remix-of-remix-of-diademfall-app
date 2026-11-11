import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForXaman } from "./action";
import type { XamanStatus } from "../../../types";

describe("Xaman sign-in progress", () => {
  afterEach(() => vi.useRealTimers());

  it("continues after scanning and notifies once per status change before resolving the account", async () => {
    vi.useFakeTimers();
    const poll = vi.fn<() => Promise<XamanStatus>>()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "scanned" })
      .mockResolvedValueOnce({ status: "scanned" })
      .mockResolvedValueOnce({ status: "signed", account: "rSigned" });
    const onStatus = vi.fn();
    const result = waitForXaman(poll, "payload", 2000, 10000, onStatus);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await result).toBe("rSigned");
    expect(poll).toHaveBeenCalledTimes(4);
    expect(poll).toHaveBeenCalledWith("payload");
    expect(onStatus.mock.calls.map(([status]) => status)).toEqual([
      { status: "pending" }, { status: "scanned" }, { status: "signed", account: "rSigned" },
    ]);
  });

  it.each(["expired", "rejected"] as const)("still stops on %s after scanning", async (status) => {
    const poll = vi.fn<() => Promise<XamanStatus>>()
      .mockResolvedValueOnce({ status: "scanned" })
      .mockResolvedValueOnce({ status });
    await expect(waitForXaman(poll, "payload", 0, 10000)).rejects.toThrow(
      status === "expired" ? "Xaman request expired" : "Sign-in rejected in Xaman",
    );
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("expires if the scanned request never receives a signature", async () => {
    vi.useFakeTimers();
    const poll = vi.fn<() => Promise<XamanStatus>>().mockResolvedValue({ status: "scanned" });
    const result = waitForXaman(poll, "payload", 2000, 4000);
    const assertion = expect(result).rejects.toThrow("Xaman request expired");
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(poll).toHaveBeenCalledTimes(2);
  });
});