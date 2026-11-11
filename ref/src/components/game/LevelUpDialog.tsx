import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { levelUpCost, MAX_HERO_LEVEL, STAT_LABEL, statRange, UPGRADE_STATS, type UpgradeStat } from "@/lib/game/heroes/leveling";
import { levelUpHero } from "@/lib/game/heroes/progression.functions";
import type { SessionHero } from "@/lib/game/session/types";
import { cn } from "@/lib/utils";

export function LevelUpDialog({ hero, playerId, token, coins, onClose, onLeveled }: {
  hero: SessionHero | null;
  playerId: string;
  token: string;
  coins?: number;
  onClose: () => void;
  onLeveled: (id: string, patch: Partial<SessionHero>, coins: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gained, setGained] = useState<UpgradeStat | null>(null);
  useEffect(() => { setError(null); setGained(null); }, [hero?.id]);
  if (!hero) return null;
  const level = hero.level ?? 1;
  const cost = levelUpCost(level);
  const levelUp = async () => {
    setBusy(true); setError(null); setGained(null);
    try {
      const r = await levelUpHero({ data: { playerId, token, heroId: hero.id } });
      setGained(r.stat);
      onLeveled(hero.id, r.hero, r.coins);
    } catch (e) { setError(e instanceof Error ? e.message : "Level up failed"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{hero.name} · Lv. {level} / {MAX_HERO_LEVEL}</DialogTitle>
          <DialogDescription>Each level adds +1 to a random stat that isn't maxed yet.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {UPGRADE_STATS.map((k) => {
            const { min, max } = statRange(hero.rarity, k);
            const v = hero[k];
            const pct = max > min ? Math.min(100, ((v - min) / (max - min)) * 100) : 100;
            return (
              <li key={k} className={cn("rounded-md p-1.5 text-sm transition-colors", gained === k && "bg-primary/15")}>
                <div className="flex justify-between"><span>{STAT_LABEL[k]}{gained === k && <span className="ml-2 font-bold text-primary">+1!</span>}</span><span className="font-mono tabular-nums">{v} / {max}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {cost === null ? (
          <p className="text-center text-sm font-semibold text-primary">Max level reached</p>
        ) : (
          <Button className="min-h-11" disabled={busy || !!hero.listed || (coins !== undefined && coins < cost)} onClick={() => void levelUp()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Level up · {cost.toLocaleString()} coins
          </Button>
        )}
        {hero.listed && <p className="text-xs text-muted-foreground">Cancel the sale before leveling up.</p>}
      </DialogContent>
    </Dialog>
  );
}
