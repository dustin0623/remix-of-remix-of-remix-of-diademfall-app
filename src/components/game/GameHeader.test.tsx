import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameHeader } from "./GameHeader";

vi.mock("@/hooks/use-account", () => ({ useAccount: () => ({ user: null, account: null }) }));
vi.mock("@/components/auth/LoginDialog", () => ({ LoginDialog: () => null }));
vi.mock("@/components/economy/WalletBadge", () => ({ WalletBadge: () => null }));
vi.mock("@/components/game/ProfileMenu", () => ({ ProfileMenu: () => null }));

describe("Market and Items navigation", () => {
  it("keeps the two Cards destinations separate and closes each menu after selection", async () => {
    const root = createRootRoute({ component: GameHeader });
    const market = createRoute({ getParentRoute: () => root, path: "/market" });
    const items = createRoute({ getParentRoute: () => root, path: "/items" });
    const ranked = createRoute({ getParentRoute: () => root, path: "/ranked" });
    const practice = createRoute({ getParentRoute: () => root, path: "/battle" });
    const codex = createRoute({ getParentRoute: () => root, path: "/codex" });
    const router = createRouter({
      routeTree: root.addChildren([market, items, ranked, practice, codex]),
      history: createMemoryHistory({ initialEntries: ["/market"] }),
    });
    render(<RouterProvider router={router} />);

    const navigation = await screen.findByRole("navigation", { name: "Main navigation" });
    const marketButton = within(navigation).getByRole("button", { name: "Market" });
    const itemsButton = within(navigation).getByRole("button", { name: "Items" });
    expect(within(navigation).queryByRole("link", { name: "Shop" })).toBeNull();

    fireEvent.click(marketButton);
    expect(within(navigation).getByRole("link", { name: "Cards" })).toHaveAttribute(
      "href",
      "/market?section=buy",
    );
    fireEvent.click(within(navigation).getByRole("link", { name: "Packs" }));
    await waitFor(() => expect(router.state.location.href).toBe("/market?section=packs"));
    expect(marketButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(itemsButton);
    expect(within(navigation).getByRole("link", { name: "Others" })).toHaveAttribute(
      "href",
      "/items?section=others",
    );
    fireEvent.click(within(navigation).getByRole("link", { name: "Cards" }));
    await waitFor(() => expect(router.state.location.href).toBe("/items?section=cards"));
    expect(itemsButton).toHaveAttribute("aria-expanded", "false");

    const war = within(navigation).getByRole("button", { name: "War" });
    const hover = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(hover, "pointerType", { value: "mouse" });
    fireEvent(war, hover);
    expect(await within(navigation).findByRole("link", { name: "Ranked" })).toHaveAttribute(
      "href",
      "/ranked",
    );
    expect(within(navigation).getByRole("link", { name: "Practice" })).toHaveAttribute(
      "href",
      "/battle",
    );
    fireEvent.click(within(navigation).getByRole("button", { name: "Challenge" }));
    expect(await screen.findByRole("dialog", { name: "Challenge a Friend" })).toBeInTheDocument();
    expect(war).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(within(navigation).getByRole("link", { name: "Codex" }));
    await waitFor(() => expect(router.state.location.href).toBe("/codex"));
  });
});
