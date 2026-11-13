import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { summonerEffectText, SummonerCardView } from "./cards";
import { SUMMONERS } from "@/game/catalog/summoners";

describe("Commander card effects", () => {
  it("uses player-facing attack names and clear team targets", () => {
    expect(
      summonerEffectText({
        effects: [
          { kind: "stat", target: "all_allies", stat: "steel", value: 1 },
          { kind: "stat", target: "all_enemies", stat: "shot", value: -1 },
          { kind: "stat", target: "all_allies", stat: "spell", value: 1 },
        ],
      }),
    ).toEqual(["Allies: +1 melee damage", "Enemies: -1 ranged damage", "Allies: +1 magic damage"]);
  });
  it("explains Magic Ward as damage reduction", () => {
    expect(
      summonerEffectText({
        effects: [{ kind: "stat", target: "all_allies", stat: "magicResistance", value: 1 }],
      }),
    ).toEqual(["Allies take 1 less magic damage"]);
  });
  it("renders a Commander card with its actual support effects", async () => {
    const commander = SUMMONERS.find((s) => s.id === "oris_glassmoth")!;
    const selectCard = vi.fn();
    render(<SummonerCardView s={commander} onClick={selectCard} />);
    expect(
      screen.getByRole("button", { name: commander.name + ", rare commander" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Allies: +1 magic damage" })).toBeInTheDocument();
    expect(screen.queryByText("Allies: +1 magic damage")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText(/all_allies|strongest_spell|grantAbility/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("img", { name: "Allies: +1 magic damage" }));
    expect(selectCard).not.toHaveBeenCalled();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Magic Boost");
    expect(tooltip).toHaveTextContent("Allies: +1 magic damage");
  });
  it("distinguishes enemy penalties from Magic Ward without labeling Ward as extra armor", () => {
    const { rerender } = render(
      <SummonerCardView s={SUMMONERS.find((s) => s.id === "vel_mourningstar")!} />,
    );
    expect(screen.getByRole("img", { name: "Enemies: -1 melee damage" })).toHaveAttribute(
      "data-target",
      "all_enemies",
    );
    expect(
      screen.queryByRole("img", { name: "Enemies: -1 ranged damage" }),
    ).not.toBeInTheDocument();
    rerender(<SummonerCardView s={SUMMONERS.find((s) => s.id === "orrun_the_first_scale")!} />);
    const ward = screen.getByRole("img", { name: "Allies take 1 less magic damage" });
    expect(ward).toHaveAttribute("data-target", "all_allies");
    expect(ward.querySelector('img[src="/assets/stats/armor.png"]')).toBeInTheDocument();
    expect(ward.querySelector('img[src="/assets/stats/spell.png"]')).toBeInTheDocument();
    expect(ward.textContent).toBe("−1");
  });
});
