import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { essenceProgress, maxEssence, planCombine } from "@/game/combining";
import type { Foil } from "@/game/packs";
import { combineCards } from "@/lib/packs/combine.functions";
import type { OwnedAsset } from "@/lib/packs/packs.queries";
import { cn } from "@/lib/utils";
import { EssenceBar, cardMeta, unlockedAbilities } from "./CardEssence";
import { OwnedCard, cardName } from "./OwnedCard";

const statusLabel: Record<string, string> = { listed: "Listed", rented: "Rented out", escrowed: "Locked" };

/** Pick copies of one card (one foil) to merge permanently into the copy with the most CE. */
export function CombineDialog({ cardId, foil, assets, onClose }: { cardId: string | null; foil: Foil; assets: OwnedAsset[]; onClose: () => void }) {
  const qc = useQueryClient();
  const combine = useServerFn(combineCards);
  const meta = cardId ? cardMeta(cardId) : null;
  const copies = useMemo(() => [...assets].sort((a, b) => b.essence - a.essence || a.createdAt.localeCompare(b.createdAt)), [assets]);
  const free = copies.filter((a) => a.status === "available");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keepId, setKeepId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSelected(new Set()); setKeepId(null); }, [cardId, foil]);

  const max = meta ? maxEssence(meta.rarity, foil) : 0;
  const chosen = free.filter((a) => selected.has(a.id));
  const top = chosen.reduce((m, a) => Math.max(m, a.essence), 0);
  const tied = chosen.filter((a) => a.essence === top);
  const keep = tied.find((a) => a.id === keepId) ?? tied[0];
  const sources = chosen.filter((a) => a.id !== keep?.id);
  const plan = meta && keep ? planCombine(meta.rarity, keep, sources) : null;
  const after = plan?.ok && meta ? essenceProgress(meta.rarity, foil, plan.essenceAfter) : null;
  const newAbilities = plan?.ok && cardId
    ? unlockedAbilities(cardId, plan.levelAfter).filter((a) => !unlockedAbilities(cardId, plan.levelBefore).includes(a)) : [];

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectMax = () => {
    const n = new Set<string>(); let total = 0;
    for (const a of free) if (total + a.essence <= max) { n.add(a.id); total += a.essence; }
    setSelected(n); setKeepId(null);
  };

  const submit = async () => {
    if (!plan?.ok || !keep) return;
    setBusy(true);
    try {
      const r = await combine({ data: { targetCardId: keep.id, sourceCardIds: sources.map((s) => s.id) } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.levelAfter > r.levelBefore ? `${cardName(cardId!)} is now level ${r.levelAfter}!` : `${cardName(cardId!)} now has ${r.essenceAfter} CE.`);
      await qc.invalidateQueries({ queryKey: ["packs"] });
      await qc.invalidateQueries({ queryKey: ["market"] });
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!cardId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Combine {cardId ? cardName(cardId) : ""}{foil === "gold" ? " (Gold)" : ""}</DialogTitle>
          <DialogDescription>
            Merge copies into one card. Their Card Essence (CE) adds up and raises its level. This is permanent: the other copies are used up.
          </DialogDescription>
        </DialogHeader>
        {cardId && meta && (
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <OwnedCard cardId={cardId} gold={foil === "gold"} size="sm" />
              <div className="w-40">
                {(plan?.ok || keep) && <EssenceBar cardId={cardId} foil={foil} essence={plan?.ok ? plan.essenceAfter : keep!.essence} />}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{free.length} free {free.length === 1 ? "copy" : "copies"} · max {max} CE (level {meta.levelCap})</p>
                <Button size="sm" variant="secondary" onClick={selectMax} disabled={free.length < 2}>Select most</Button>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                {copies.map((a, i) => {
                  const locked = a.status !== "available";
                  const isKeep = keep?.id === a.id && chosen.length > 1;
                  return (
                    <li key={a.id} className={cn("flex items-center gap-3 rounded px-2 py-1.5 text-sm", isKeep && "bg-primary/10", locked && "opacity-50")}>
                      <Checkbox id={`c-${a.id}`} checked={selected.has(a.id)} disabled={locked} onCheckedChange={() => toggle(a.id)} aria-label={`Copy ${i + 1}`} />
                      <label htmlFor={`c-${a.id}`} className="flex-1 cursor-pointer">
                        Copy {i + 1} · <span className="font-semibold">Lv {a.level}</span> · {a.essence} CE
                        {locked && <span className="ml-1 text-xs text-muted-foreground">({statusLabel[a.status] ?? a.status})</span>}
                      </label>
                      {selected.has(a.id) && tied.length > 1 && a.essence === top && (
                        <button type="button" onClick={() => setKeepId(a.id)} className={cn("rounded border px-2 py-0.5 text-[10px] font-bold uppercase", isKeep ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                          {isKeep ? "Keeps" : "Keep this"}
                        </button>
                      )}
                      {isKeep && tied.length === 1 && <span className="text-[10px] font-bold uppercase text-primary">Keeps</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="rounded-md border border-border bg-background/40 p-3 text-sm">
                {chosen.length < 2 ? <p className="text-muted-foreground">Tick at least two copies. The one with the most CE survives.</p>
                  : plan && !plan.ok ? <p className="text-destructive">{plan.error}</p>
                  : plan?.ok && after ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-display font-black uppercase">
                        <span>Lv {plan.levelBefore}</span><ArrowRight className="size-4 text-primary" /><span className="text-primary">Lv {plan.levelAfter}</span>
                        <span className="ml-auto font-sans text-xs font-normal normal-case text-muted-foreground">{plan.essenceBefore} + {plan.essenceAdded} = {plan.essenceAfter} CE</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{after.atMax ? "Maximum level reached." : `${after.nextLevelEssence! - plan.essenceAfter} more CE to level ${after.level + 1}.`}</p>
                      {newAbilities.length > 0 && <p className="text-xs">New abilities: <span className="font-semibold text-primary">{newAbilities.join(", ")}</span></p>}
                    </div>
                  ) : null}
              </div>
              <Button className="w-full" disabled={!plan?.ok || busy} onClick={submit}>
                {busy ? <Loader2 className="animate-spin" /> : chosen.length >= 2 ? `Combine ${chosen.length} cards` : "Combine cards"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
