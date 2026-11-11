import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HOUSE_TIERS, type PlayerHouse } from "@/lib/game/houses/houses";
import { listHouses, setHeroHouse } from "@/lib/game/houses/houses.functions";
import type { SessionHero } from "@/lib/game/session/types";

/** Pick which registered house a hero should rest in. */
export function RestInHouseDialog({ hero, heroes, playerId, token, onClose, onMoved }: {
  hero: SessionHero | null;
  heroes: SessionHero[];
  playerId: string;
  token: string;
  onClose: () => void;
  onMoved: (heroId: string, house: PlayerHouse, energy: number) => void;
}) {
  const [houses, setHouses] = useState<PlayerHouse[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!hero) return;
    setHouses(null);
    listHouses({ data: { playerId, token } }).then(setHouses).catch(() => setHouses([]));
  }, [hero, playerId, token]);

  const choose = async (house: PlayerHouse) => {
    if (!hero) return;
    setBusy(house.id);
    try {
      const { energy } = await setHeroHouse({ data: { playerId, token, heroId: hero.id, houseId: house.id } });
      onMoved(hero.id, house, energy);
      toast.success(`${hero.name} is resting in your ${HOUSE_TIERS[house.rarity].name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move hero");
    } finally { setBusy(null); }
  };

  return (
    <Dialog open={!!hero} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rest {hero?.name} in a house</DialogTitle>
          <DialogDescription>Heroes in a house recover energy faster but can't be deployed.</DialogDescription>
        </DialogHeader>
        {!houses ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : houses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No houses yet. <Link to="/profile" className="text-primary underline">Register one on your Profile.</Link></p>
        ) : (
          <div className="space-y-2">
            {houses.map((house) => {
              const tier = HOUSE_TIERS[house.rarity];
              const used = heroes.filter((h) => h.houseId === house.id).length;
              const full = used >= tier.slots;
              return (
                <Button key={house.id} variant="outline" className="h-auto w-full justify-start gap-3 py-3" disabled={full || !!busy} onClick={() => void choose(house)}>
                  <Home className="size-5 text-primary" />
                  <span className="flex-1 text-left">
                    <span className="block font-semibold">{tier.name} <span className="text-xs capitalize text-muted-foreground">· {house.rarity}</span></span>
                    <span className="block text-xs text-muted-foreground">+{tier.bonusPerHour} energy/hr · {used}/{tier.slots} beds</span>
                  </span>
                  {busy === house.id ? <Loader2 className="size-4 animate-spin" /> : full ? <span className="text-xs">Full</span> : null}
                </Button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
