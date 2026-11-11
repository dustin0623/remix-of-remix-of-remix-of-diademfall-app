// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletContent, validWithdrawalAmount } from "./WalletContent";

afterEach(cleanup);
const props = {
  coins: 12500,
  walletAddress: "Connected test wallet",
  deposit: { address: null, tag: 1234 },
  onRefresh: vi.fn(),
  onOpenHistory: vi.fn(),
};

describe("withdrawal amounts", () => {
  it.each(["", "0", "-1", "1.5", "12501", "Infinity", "not a number"])(
    "rejects invalid amount %s",
    (amount) => {
      expect(validWithdrawalAmount(amount, 12500)).toBe(false);
    },
  );
  it("accepts whole amounts up to the available balance", () => {
    expect(validWithdrawalAmount("1", 12500)).toBe(true);
    expect(validWithdrawalAmount("12500", 12500)).toBe(true);
  });
});

describe("wallet page", () => {
  it("supports keyboard navigation between wallet tabs", () => {
    render(<WalletContent {...props} onWithdraw={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Deposit" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Withdraw" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Withdraw" }));
  });
  it("keeps unconfigured deposits unavailable instead of inventing an address", () => {
    render(<WalletContent {...props} onWithdraw={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Deposits open soon" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy treasury address" })).toBeNull();
  });
  it("shows configured deposit details and their destination tag", () => {
    render(
      <WalletContent
        {...props}
        deposit={{ address: "Treasury test address", tag: 987654 }}
        onWithdraw={vi.fn()}
      />,
    );
    expect(screen.getByText("Treasury test address")).toBeTruthy();
    expect(screen.getByText("987654")).toBeTruthy();
  });
  it("fills percentage amounts, requires review, and prevents duplicate submissions", async () => {
    let finish!: (result: { coins: number; transactionId: string }) => void;
    const onWithdraw = vi.fn(
      () =>
        new Promise<{ coins: number; transactionId: string }>((resolve) => {
          finish = resolve;
        }),
    );
    render(<WalletContent {...props} initialTab="withdraw" onWithdraw={onWithdraw} />);
    fireEvent.click(screen.getByRole("button", { name: "25%" }));
    expect(
      (screen.getByRole("spinbutton", { name: "Withdrawal amount" }) as HTMLInputElement).value,
    ).toBe("3125");
    fireEvent.click(screen.getByRole("button", { name: "Review withdrawal" }));
    expect(onWithdraw).not.toHaveBeenCalled();
    expect(screen.getByText("3,125 gold")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Confirm withdrawal" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onWithdraw).toHaveBeenCalledExactlyOnceWith(3125);
    await act(async () => finish({ coins: 9375, transactionId: "queued-1" }));
    expect(screen.getByText(/Withdrawal queued. Your coins have been reserved/)).toBeTruthy();
  });
  it("blocks excessive amounts and withdrawals without a linked wallet", () => {
    const view = render(<WalletContent {...props} initialTab="withdraw" onWithdraw={vi.fn()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Withdrawal amount" }), {
      target: { value: "12501" },
    });
    expect(
      (screen.getByRole("button", { name: "Review withdrawal" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    view.rerender(
      <WalletContent {...props} walletAddress={null} initialTab="withdraw" onWithdraw={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "MAX" }));
    expect(
      (screen.getByRole("button", { name: "Review withdrawal" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it("keeps failed requests in review for an explicit retry", async () => {
    const onWithdraw = vi.fn().mockRejectedValue(new Error("Not enough coins"));
    render(<WalletContent {...props} initialTab="withdraw" onWithdraw={onWithdraw} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Withdrawal amount" }), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review withdrawal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Not enough coins");
    expect(screen.getByRole("heading", { name: "Review withdrawal" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Confirm withdrawal" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
  it("sends players to the account history page instead of an activity tab", () => {
    const onOpenHistory = vi.fn();
    render(<WalletContent {...props} onOpenHistory={onOpenHistory} onWithdraw={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: "Activity" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /View full account history/ }));
    expect(onOpenHistory).toHaveBeenCalledOnce();
  });
});
