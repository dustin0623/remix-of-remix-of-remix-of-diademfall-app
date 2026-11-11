import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HousePicker } from "./HousePicker";
import { listHouses, registerDemoHouse, unregisterHouse } from "@/lib/game/houses/houses.functions";
import type { HouseRarity, PlayerHouse } from "@/lib/game/houses/houses";
import { useGameStore } from "@/features/stores/game.store";

/** Free demo selection, using the existing wallet-validated one-house registration rules. */
export function HouseRegistration({ playerId, token }: { playerId: string; token: string }) {
  const [houses, setHouses] = useState<PlayerHouse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const current = await listHouses({ data: { playerId, token } });
    setHouses(current);
    setError(null);
    return current;
  }, [playerId, token]);
  useEffect(() => {
    let cancelled = false;
    listHouses({ data: { playerId, token } })
      .then((current) => {
        if (!cancelled) {
          setHouses(current);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHouses([]);
          setError("Could not load your current house. Selecting a house will retry.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, token]);
  const choose = async (rarity: HouseRarity) => {
    // Refresh first: never replace a house based only on stale browser state.
    const current = await load();
    if (current.some((h) => h.rarity === rarity)) return;
    if (current.some((h) => !h.isDemo))
      throw new Error("An NFT house cannot be replaced through the demo selector.");
    try {
      for (const house of current)
        await unregisterHouse({ data: { playerId, token, houseId: house.id } });
      await registerDemoHouse({ data: { playerId, token, rarity } });
    } finally {
      // Keep the UI honest even if registration fails after removing the old demo.
      useGameStore.getState().setSession(null, null);
      await load();
    }
  };
  return (
    <HousePicker
      selected={houses?.[0]?.rarity ?? null}
      loading={houses === null}
      error={error}
      onChoose={choose}
      onOpen={() => void navigate({ to: "/house" })}
    />
  );
}
