import { useState } from "react";
import { Check, Lock, Loader2, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTemplatesByKind,
  isCosmeticUnlocked,
  PARTNERSHIP_SLOTS,
  type CosmeticKind,
} from "@/lib/game/profile/cosmetics";
import { cn } from "@/lib/utils";

const KINDS: CosmeticKind[] = ["avatar", "background"];

export function EditCosmeticsDialog({
  open,
  onOpenChange,
  level,
  equipped,
  onEquip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: number;
  equipped: Record<CosmeticKind, number>;
  onEquip: (kind: CosmeticKind, templateId: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const pick = async (kind: CosmeticKind, id: number) => {
    setBusy(id);
    try {
      await onEquip(kind, id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save appearance");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit cosmetics</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="avatar">
          <TabsList className="grid w-full grid-cols-2">
            {KINDS.map((k) => (
              <TabsTrigger key={k} value={k} className="capitalize">
                {k}s
              </TabsTrigger>
            ))}
          </TabsList>
          {KINDS.map((kind) => (
            <TabsContent key={kind} value={kind} className="max-h-[60vh] overflow-y-auto pr-1">
              {(["heroes", "special"] as const).map((collection) => (
                <section key={collection} className="pf-cosmetic-section">
                  <h3>{collection === "heroes" ? "Heroes · 1–10" : "Special cards · 11–20"}</h3>
                  <div
                    className={cn(
                      "grid gap-3",
                      kind === "avatar"
                        ? "grid-cols-3 sm:grid-cols-5"
                        : "grid-cols-2 sm:grid-cols-3",
                    )}
                  >
                    {getTemplatesByKind(kind)
                      .filter((t) => t.collection === collection)
                      .map((t) => {
                        const unlocked = isCosmeticUnlocked(t, level);
                        const active = equipped[kind] === t.templateId;
                        return (
                          <button
                            key={t.templateId}
                            aria-label={`${t.name}${active ? ", equipped" : !unlocked ? `, unlocks at level ${t.requiredLevel}` : ", equip"}`}
                            type="button"
                            disabled={!unlocked || active || busy !== null}
                            onClick={() => pick(kind, t.templateId)}
                            className={cn(
                              "group relative overflow-hidden rounded-xl border text-left transition",
                              active
                                ? "border-primary ring-2 ring-primary"
                                : "border-border hover:border-primary/60",
                              !unlocked && "opacity-50",
                            )}
                          >
                            <img
                              src={t.image}
                              alt={t.name}
                              className={cn(
                                "w-full object-cover",
                                kind === "avatar" ? "aspect-square" : "aspect-video",
                              )}
                              loading="lazy"
                            />
                            <div className="flex items-center justify-between gap-1 bg-card/90 px-2 py-1 text-[11px]">
                              <span className="truncate">
                                {t.slot}. {t.name}
                              </span>
                              {active ? (
                                <Check className="size-3 text-primary" />
                              ) : !unlocked ? (
                                <span className="flex items-center gap-0.5 text-muted-foreground">
                                  <Lock className="size-3" />
                                  {t.requiredLevel}
                                </span>
                              ) : null}
                            </div>
                            {busy === t.templateId ? (
                              <div className="absolute inset-0 grid place-items-center bg-background/60">
                                <Loader2 className="size-5 animate-spin" />
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                </section>
              ))}
              <section className="pf-cosmetic-section">
                <h3>Partnerships · 21–25</h3>
                <div className="pf-partnerships">
                  {PARTNERSHIP_SLOTS.map((slot) => (
                    <div key={slot} aria-label={`Slot ${slot}, reserved for partnerships`}>
                      <Handshake />
                      <strong>{slot}</strong>
                      <span>Reserved</span>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
