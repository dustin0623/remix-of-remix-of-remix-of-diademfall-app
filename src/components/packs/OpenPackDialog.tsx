import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PACK_INFO, randomSeed, verifyOpening, type PackId } from "@/game/packs";
import { commitPackOpening, revealPackOpening, type RevealResult } from "@/lib/packs/packs.functions";
import { cn } from "@/lib/utils";
import { OwnedCard } from "./OwnedCard";
import { PACK_ART } from "./packArt";

type Revealed = Extract<RevealResult, { ok: true }>;

/** Commit → player seed → reveal, with a one-by-one card flip and an in-browser fairness check. */
export function OpenPackDialog({ pack, open, onOpenChange }: { pack: PackId | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const commit = useServerFn(commitPackOpening);
  const reveal = useServerFn(revealPackOpening);
  const [stage, setStage] = useState<"committing" | "ready" | "revealing" | "done" | "error">("committing");
  const [commitment, setCommitment] = useState<{ openingId: string; commitHash: string } | null>(null);
  const [clientSeed, setClientSeed] = useState("");
  const [result, setResult] = useState<Revealed | null>(null);
  const [flipped, setFlipped] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !pack) return;
    setStage("committing"); setResult(null); setFlipped(0); setError(""); setClientSeed(randomSeed(16));
    let cancelled = false;
    void commit({ data: { pack } }).then((r) => {
      if (cancelled) return;
      if (!r.ok) { setError(r.error); setStage("error"); return; }
      setCommitment({ openingId: r.openingId, commitHash: r.commitHash }); setStage("ready");
    });
    return () => { cancelled = true; };
  }, [open, pack, commit]);

  useEffect(() => {
    if (stage !== "done" || !result || flipped >= result.cards.length) return;
    const t = setTimeout(() => setFlipped((f) => f + 1), flipped === 0 ? 350 : 550);
    return () => clearTimeout(t);
  }, [stage, result, flipped]);

  const doReveal = async () => {
    if (!commitment) return;
    setStage("revealing");
    const r = await reveal({ data: { openingId: commitment.openingId, clientSeed } });
    if (!r.ok) { setError(r.error); setStage("error"); return; }
    setResult(r); setStage("done");
    void qc.invalidateQueries({ queryKey: ["packs"] });
    void qc.invalidateQueries({ queryKey: ["account"] });
  };

  const verified = result ? verifyOpening({ pack: result.pack, commitHash: result.commitHash, serverSeed: result.serverSeed, clientSeed: result.clientSeed, openingId: result.openingId, cards: result.cards }) : null;
  const allShown = result ? flipped >= result.cards.length : false;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (stage !== "revealing") onOpenChange(o); }}>
      <DialogContent className="max-w-5xl border-primary/40 bg-night">
        <DialogHeader>
          <DialogTitle className="title-portal text-2xl">{pack ? PACK_INFO[pack].name : "Pack"}</DialogTitle>
          <DialogDescription>Five cards. One slot is always Uncommon or better, and every card has a 2% chance to be Gold.</DialogDescription>
        </DialogHeader>

        {stage === "error" && <p className="rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {(stage === "committing" || stage === "ready" || stage === "revealing") && pack && (
          <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
            <img src={PACK_ART[pack]} alt={PACK_INFO[pack].name} width={768} height={1024} className={cn("mx-auto w-48 rounded-lg shadow-glow", stage === "revealing" && "animate-pulse")} />
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Server commitment (locked before you choose)</div>
                <code className="mt-1 block break-all rounded bg-background/60 p-2 text-[11px] text-arcane">{commitment?.commitHash ?? "…"}</code>
              </div>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Your seed (change it if you like)</span>
                <Input value={clientSeed} onChange={(e) => setClientSeed(e.target.value.slice(0, 64))} className="mt-1 font-mono text-xs" disabled={stage !== "ready"} />
              </label>
              <button type="button" onClick={doReveal} disabled={stage !== "ready" || clientSeed.length < 8}
                className="btn-ornate w-full px-8 py-3 font-display text-lg font-black uppercase italic tracking-wider text-primary-foreground disabled:opacity-50">
                {stage === "committing" ? <><Loader2 className="mr-2 inline size-4 animate-spin" />Preparing…</> : stage === "revealing" ? <><Loader2 className="mr-2 inline size-4 animate-spin" />Opening…</> : "Open pack"}
              </button>
            </div>
          </div>
        )}

        {stage === "done" && result && pack && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-center gap-3">
              {result.cards.map((c, i) => (
                <div key={c.assetId} className="card-flip">
                  <div className={cn("card-flip-inner", i < flipped && "is-flipped")}>
                    <div className="card-flip-back overflow-hidden rounded-lg border-2 border-primary/50">
                      <img src={PACK_ART[pack]} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="card-flip-front"><OwnedCard cardId={c.cardId} gold={c.foil === "gold"} size="sm" /></div>
                  </div>
                  <div className={cn("mt-1 text-center text-[10px] font-bold uppercase tracking-wider transition-opacity", i < flipped ? "opacity-100" : "opacity-0")} style={{ color: `var(--rarity-${c.rarity})` }}>{c.rarity}{c.foil === "gold" ? " · Gold" : ""}</div>
                </div>
              ))}
            </div>
            {allShown && (
              <details className="rounded-lg border border-border bg-background/40 p-3 text-xs">
                <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                  <ShieldCheck className="size-4 text-primary" /> Fairness check
                  {verified ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" />Verified in your browser</span>
                    : <span className="flex items-center gap-1 text-destructive"><XCircle className="size-3.5" />Does not match</span>}
                </summary>
                <dl className="mt-2 grid gap-1 font-mono text-[11px] md:grid-cols-[140px_1fr]">
                  <dt className="text-muted-foreground">Commitment</dt><dd className="break-all">{result.commitHash}</dd>
                  <dt className="text-muted-foreground">Server seed</dt><dd className="break-all">{result.serverSeed}</dd>
                  <dt className="text-muted-foreground">Your seed</dt><dd className="break-all">{result.clientSeed}</dd>
                  <dt className="text-muted-foreground">Opening id</dt><dd className="break-all">{result.openingId}</dd>
                </dl>
                <p className="mt-2 text-muted-foreground">sha256(server seed) equals the commitment shown before you picked your seed, and the five cards are recomputed from both seeds with the published pack algorithm.</p>
              </details>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
