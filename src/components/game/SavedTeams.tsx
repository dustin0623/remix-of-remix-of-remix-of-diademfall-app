import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/stores/auth.store";
import { BANNER_BY_ID } from "@/game/banners";
import { SUMMONERS } from "@/game/catalog/summoners";
import { retiredCards } from "@/game/catalogs";
import type { MatchConfig, TeamPick } from "@/game/match";
import { DECK_NAME_MAX, decksKey, decksQuery, deleteTeam, saveTeam, type SavedTeam } from "@/lib/decks/decks";
import { cn } from "@/lib/utils";

/** Save the current draft and load saved teams. Loading drops cards the player can't use here; the draft validator flags the rest. */
export function SavedTeams({ cfg, pick, setPick, owned, check }: {
  cfg: MatchConfig;
  pick: TeamPick;
  setPick: Dispatch<SetStateAction<TeamPick>>;
  owned?: Record<string, number> | undefined;
  check: (p: TeamPick) => string | null;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const decks = useQuery(decksQuery(userId));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!userId) return null;

  // Drop retired Alpha/Beta cards and cards the player doesn't own; the draft validator flags the rest.
  const usable = (d: SavedTeam): TeamPick => {
    const retired = new Set(retiredCards(d.pick));
    return { summonerId: retired.has(d.pick.summonerId) ? "" : d.pick.summonerId, unitIds: d.pick.unitIds.filter((id) => !retired.has(id) && (!owned || owned[id] !== undefined)) };
  };
  const save = async () => {
    setBusy(true);
    try {
      const err = await saveTeam(userId, name, pick);
      if (err) { toast.error(err); return; }
      toast.success(`Saved "${name.trim()}".`);
      setName("");
      await qc.invalidateQueries({ queryKey: decksKey(userId) });
    } finally { setBusy(false); }
  };
  const remove = async (d: SavedTeam) => {
    if (!(await deleteTeam(d.id))) { toast.error("Couldn't delete that team."); return; }
    await qc.invalidateQueries({ queryKey: decksKey(userId) });
  };

  const list = decks.data ?? [];
  const here = list.filter((d) => cfg.banners.includes(d.bannerId as never));
  const elsewhere = list.length - here.length;

  return (
    <div className="space-y-2 rounded-lg border border-border p-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Bookmark className="size-3" /> Saved teams</div>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={DECK_NAME_MAX} placeholder="Name this team" className="h-8 text-xs" aria-label="Team name" />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || !name.trim() || !pick.summonerId || pick.unitIds.length === 0}>
          {busy ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
      </form>
      {decks.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : here.length === 0 ? (
        <p className="text-xs text-muted-foreground">{list.length ? "None of your saved teams fit this match's banners." : "No saved teams yet."}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {here.map((d) => {
            const p = usable(d);
            const problem = retiredCards(d.pick).length ? "Uses retired Alpha/Beta cards — rebuild this team"
              : p.unitIds.length < d.pick.unitIds.length ? "Some cards aren't in your collection" : check(p);
            const s = SUMMONERS.find((x) => x.id === d.pick.summonerId);
            return (
              <li key={d.id} className="flex items-center gap-2 rounded-md bg-background/50 px-2 py-1">
                <button className="min-w-0 flex-1 text-left" onClick={() => setPick(p)} title={problem ?? "Load this team"}>
                  <div className="truncate text-xs font-semibold">{d.name}</div>
                  <div className={cn("truncate text-[10px]", problem ? "text-destructive" : "text-muted-foreground")}>
                    {problem ?? `${s?.name ?? "?"} · ${d.pick.unitIds.length} units · ${BANNER_BY_ID[d.bannerId as keyof typeof BANNER_BY_ID]?.name ?? ""}`}
                  </div>
                </button>
                <button onClick={() => void remove(d)} aria-label={`Delete ${d.name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </li>
            );
          })}
        </ul>
      )}
      {elsewhere > 0 && here.length > 0 && <p className="text-[10px] text-muted-foreground">{elsewhere} more saved for other banners.</p>}
    </div>
  );
}
