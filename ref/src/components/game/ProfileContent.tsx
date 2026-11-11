import { optimizedImage } from "@/lib/assets/optimized-images";
import { useState, type ReactNode } from "react";
import {
  Check,
  Coins,
  Loader2,
  Palette,
  Package,
  Pencil,
  Star,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { EditCosmeticsDialog } from "./EditCosmeticsDialog";
import { HERO_COLLECTION_RARITIES } from "@/lib/game/profile/collection";
import { CHEST_TEXTURE, ChestRarity } from "@/game/data/ChestRarity";
import { cosmeticImage, type CosmeticKind } from "@/lib/game/profile/cosmetics";
import { levelProgress } from "@/lib/game/profile/level";
import type { PlayerProfile } from "@/lib/game/profile/profile.functions";
import "@/styles/profile.css";

const fmt = (n: number) => n.toLocaleString("en-US");
const RARITIES = Object.values(ChestRarity);

/** Open profile scene shared by live routes and the offline test bench. */
export function ProfileContent({
  profile,
  rename,
  onEquip,
  houseRegistration,
}: {
  profile: PlayerProfile;
  rename: (username: string) => Promise<void>;
  onEquip: (kind: CosmeticKind, templateId: number) => Promise<void>;
  houseRegistration?: ReactNode;
}) {
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const progress = levelProgress(profile.xp);
  const avatar = cosmeticImage(profile.avatarId, "avatar");
  const equipped = {
    avatar: profile.avatarId,
    background: profile.backgroundId,
  };
  const saveName = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await rename(draft);
      setEditing(false);
      toast.success("Username updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="pf-page" aria-label="Player profile">
      <header className="pf-identity">
        <div className="pf-avatar">
          {avatar ? <img src={avatar} alt="" /> : profile.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="pf-player">
          <span className="pf-eyebrow">Your journey in Vexaria</span>
          <div className="pf-name-row">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveName();
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={20}
                  autoFocus
                  aria-label="Username"
                />
                <button
                  type="submit"
                  className="pf-icon-button"
                  disabled={saving}
                  aria-label="Save username"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Check />}
                </button>
                <button
                  type="button"
                  className="pf-icon-button"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                  aria-label="Cancel username change"
                >
                  <X />
                </button>
              </form>
            ) : (
              <>
                <h1>{profile.username}</h1>
                <button
                  className="pf-icon-button"
                  onClick={() => {
                    setDraft(profile.username);
                    setEditing(true);
                  }}
                  aria-label="Change username"
                >
                  <Pencil />
                </button>
              </>
            )}
            <span className="pf-level">
              <Star />
              {progress.level}
            </span>
          </div>
          <p className="pf-member">
            Adventuring since{" "}
            {new Date(profile.memberSince).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
          <div className="pf-progress">
            <div
              role="progressbar"
              aria-label="Level progress"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <span>
              {fmt(progress.intoLevel)} / {fmt(progress.levelSpan)} XP to level {progress.level + 1}
            </span>
          </div>
        </div>
        <button className="pf-secondary" onClick={() => setCosmeticsOpen(true)}>
          <Palette />
          Edit cosmetics
        </button>
      </header>
      <div className="pf-milestones">
        {[
          {
            label: "Total experience",
            value: `${fmt(profile.xp)} XP`,
            hint: `Next level at ${fmt(progress.nextLevelXp)} XP`,
            icon: Sparkles,
          },
          {
            label: "Gold claimed",
            value: fmt(profile.totalGoldClaimed),
            hint: `${fmt(profile.coins)} available`,
            icon: Coins,
          },
          {
            label: "Chests broken",
            value: fmt(profile.totalChests),
            hint: "Across your adventures",
            icon: Package,
          },
          {
            label: "Heroes collected",
            value: fmt(profile.heroes.total),
            hint: "In your collection",
            icon: Users,
          },
        ].map((stat) => (
          <div key={stat.label}>
            <span>
              <stat.icon />
              {stat.label}
            </span>
            <strong>{stat.value}</strong>
            <small>{stat.hint}</small>
          </div>
        ))}
      </div>
      {houseRegistration}
      <section className="pf-collections">
        <header className="pf-section-heading">
          <div>
            <span className="pf-eyebrow">Every rarity counts</span>
            <h2>Your collection</h2>
            <p>Heroes collected and chests broken across your adventures.</p>
          </div>
        </header>
        <div className="pf-rarity-list">
          {HERO_COLLECTION_RARITIES.map((rarity) => (
            <div key={rarity} data-rarity={rarity}>
              <img src={optimizedImage(`/game/emblems/${rarity}_emblem.png`)} alt="" />
              <h3>{rarity}</h3>
              <strong>
                {fmt(profile.heroes.byRarity[rarity])}
                <small>heroes</small>
              </strong>
              <span>
                <img
                  src={`/game/items/chests/${CHEST_TEXTURE[rarity as ChestRarity]}.png`}
                  alt=""
                />
                {fmt(profile.chests[rarity as ChestRarity])} chests broken
              </span>
            </div>
          ))}
        </div>
      </section>
      <EditCosmeticsDialog
        open={cosmeticsOpen}
        onOpenChange={setCosmeticsOpen}
        level={progress.level}
        equipped={equipped}
        onEquip={onEquip}
      />
    </section>
  );
}
