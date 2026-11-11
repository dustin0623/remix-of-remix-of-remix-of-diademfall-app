import { optimizedImage } from "@/lib/assets/optimized-images";
import type { ReactNode } from "react";
import { Gem } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeroPortrait, HeroStats } from "@/components/game/HeroCollectionCard";
import { SKILL_INFO, type SkillId } from "@/lib/game/heroes/skills";
import { MAX_HERO_LEVEL } from "@/lib/game/heroes/leveling";
import type { SessionHero } from "@/lib/game/session/types";

export function HeroDetailsDialog({ hero, onClose, actions }: {
  hero: SessionHero | null;
  onClose: () => void;
  actions: ReactNode;
}) {
  const skills = (hero?.skills ?? []).filter((id): id is SkillId => Object.hasOwn(SKILL_INFO, id));
  return (
    <Dialog open={Boolean(hero)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {hero && <DialogContent className="hc-detail hc-detail-modal" data-rarity={hero.rarity} scrollBody={false}>
        <div className="hc-detail-scroll">
          <div className="hc-detail-heading">
            <Gem aria-hidden="true" />
            <div>
              <DialogTitle>{hero.name.replace(/\s*#\d+\s*$/, "").trim()}</DialogTitle>
              <span className="hc-rarity">{hero.rarity}</span>
            </div>
          </div>
          <DialogDescription className="sr-only">Hero stats, skills and actions.</DialogDescription>
          <HeroPortrait hero={hero} large />
          <div className="hc-detail-level">
            <strong>Lv. {hero.level ?? 1}/{MAX_HERO_LEVEL}</strong>
            <span>{hero.houseId ? "In house" : hero.listed ? "Listed" : hero.onMap ? "Working" : "Resting"}</span>
          </div>
          <div className="hc-detail-content">
            <Tabs key={hero.id} defaultValue="stats">
              <TabsList>
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <TabsContent value="stats"><HeroStats hero={hero} /></TabsContent>
              <TabsContent value="skills">
                <div className="hc-skills">
                  {skills.length ? skills.map((id) => <div key={id}>
                    <img src={optimizedImage(`/game/skills/${id}.png`)} alt="" width={32} height={32} className="size-8 object-contain" />
                    <strong>{SKILL_INFO[id].name}</strong><p>{SKILL_INFO[id].effect}</p>
                  </div>) : <p>No passive skills.</p>}
                </div>
              </TabsContent>
              <TabsContent value="details">
                <dl className="hc-info">
                  <dt>Type</dt><dd>{hero.type}</dd>
                  <dt>Rarity</dt><dd>{hero.rarity}</dd>
                  <dt>Level</dt><dd>{hero.level ?? 1}/{MAX_HERO_LEVEL}</dd>
                  {hero.listed && <><dt>Sale price</dt><dd>{hero.marketPrice?.toLocaleString() ?? "—"} coins</dd></>}
                </dl>
              </TabsContent>
            </Tabs>
            <div className="hc-actions">{actions}</div>
          </div>
          </div>
        </DialogContent>}
      </Dialog>
    );
  }
