import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listHeroForSale } from "@/lib/game/heroes/market.functions";
import type { SessionHero } from "@/lib/game/session/types";
import { marketQuote } from "@/lib/game/heroes/market-economy";

export function SellHeroDialog({ hero, playerId, token, onClose, onListed, preview }: {
  hero: SessionHero | null;
  playerId?: string;
  token?: string;
  preview?: { list: (heroId: string, price: number) => Promise<void> };
  onClose: () => void;
  onListed: (heroId: string, price: number) => void;
}) {
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quote = Number.isSafeInteger(Number(price)) && Number(price) > 0 ? marketQuote(Number(price)) : null;
  useEffect(() => { setPrice(""); setError(null); }, [hero?.id]);

  const submit = async () => {
    if (!hero) return;
    const value = Number(price);
    if (!Number.isSafeInteger(value) || value <= 0) return setError("Enter a whole price above 0");
    setBusy(true); setError(null);
    try {
      if (preview) await preview.list(hero.id, value);
      else if (playerId && token) await listHeroForSale({ data: { playerId, token, heroId: hero.id, price: value } });
      else throw new Error("Connect your wallet before listing a hero.");
      onListed(hero.id, value);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not list hero"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!hero} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell {hero?.name}</DialogTitle>
          <DialogDescription>Listed heroes can't be deployed. You can cancel until the hero is sold.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="sell-price">Price (coins)</Label>
          <Input id="sell-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 250" />
          <p className="text-sm text-muted-foreground">5% market fee is burned, rounded up to a whole coin.{quote && <> Fee: {quote.fee.toLocaleString()} coins · You receive {quote.proceeds.toLocaleString()} coins.</>}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !price} onClick={() => void submit()}>{busy ? "Listing…" : "List for sale"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
