import { useMemo, useState, type ReactElement } from "react";
import { Users, X } from "lucide-react";
import { HeroCollectionCard } from "./HeroCollectionCard";
import { HeroActionsPopover } from "./HeroActionsPopover";
import { HeroActions } from "./HeroActions";
import { DEFAULT_FILTERS, HeroCollectionFilters } from "./HeroFilters";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useGameStore } from "@/features/stores/game.store";
import { MAX_ON_MAP } from "@/lib/config/constants/game";
import { filterHeroes, sortCollectionHeroes } from "@/lib/game/heroes/ranking";
import "@/styles/heroes-collection.css";
import "@/styles/heroes-drawer.css";

/** Live roster actions are sent to the scene immediately, one hero at a time. */
export function HeroesDrawer({ trigger }: { trigger?: ReactElement } = {}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const roster = useGameStore((s) => s.roster);
  const deployError = useGameStore((s) => s.deployError);
  const sendCommand = useGameStore((s) => s.sendCommand);
  const onMapCount = roster.filter((hero) => hero.onMap).length;
  const shown = useMemo(() => sortCollectionHeroes(filterHeroes(roster, filters), "deploy", filters.sort), [roster, filters]);
  return <Sheet open={open} onOpenChange={(next) => { setSelectedId(null); setOpen(next); }}>
    <SheetTrigger asChild>{trigger ?? <Button variant="outline" size="sm"><Users /> Heroes {onMapCount}/{MAX_ON_MAP}</Button>}</SheetTrigger>
    <SheetContent side="right" className="hd-sheet hc-page" overlayClassName="hd-overlay">
      <SheetTitle className="sr-only">Heroes</SheetTitle>
      <SheetDescription className="sr-only">View your collection and open a hero's actions to deploy or recall it.</SheetDescription>
      <header className="hd-head">
        <HeroCollectionFilters selectorsOnly value={filters} heroes={roster} onChange={(next) => { setSelectedId(null); setFilters(next); }} />
        <SheetClose className="hd-close" aria-label="Close heroes"><X /></SheetClose>
      </header>
      {deployError && <p className="hd-error" role="alert">{deployError}</p>}
      <div className="hd-scroll">
        {shown.length ? <div className="hc-grid hd-grid">
          {shown.map((hero) => <HeroActionsPopover key={hero.id} hero={hero}
            open={selectedId === hero.id} onOpenChange={(next) => setSelectedId(next ? hero.id : null)}
            actions={<HeroActions hero={hero} layout="popover" onMapCount={onMapCount}
              onToggle={() => sendCommand({ type: hero.onMap ? "recall" : "deploy", heroId: hero.id })} />}>
            <HeroCollectionCard hero={hero} selected={false} popoverOpen={selectedId === hero.id} onSelect={() => setSelectedId((current) => current === hero.id ? null : hero.id)} />
          </HeroActionsPopover>)}
        </div> : <p className="hd-empty">{roster.length ? "No heroes match." : "No heroes yet — visit Shop to summon your first hero."}</p>}
      </div>
    </SheetContent>
  </Sheet>;
}
