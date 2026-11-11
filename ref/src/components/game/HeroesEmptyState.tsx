import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared zero-heroes empty state for the Heroes collection (production and Test UI). */
export function HeroesEmptyState({ onShop }: { onShop: () => void }) {
  return (
    <div className="hc-empty-hero">
      <img src="/game/hud/heroes_empty.webp?v=2" alt="" aria-hidden="true" />
      <h2>
        No <span>Heroes Yet!</span>
      </h2>
      <p>Visit the Shop to mint heroes and build your mining crew!</p>
      <Button className="hc-mint-cta" onClick={onShop}>
        <Store />
        Open Shop
      </Button>
    </div>
  );
}
