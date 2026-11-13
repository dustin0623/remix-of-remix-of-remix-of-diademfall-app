import { Link } from "@tanstack/react-router";
import { BookOpen, Shield, Swords, WandSparkles } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HowToPlay({
  className = "play-small-button",
  painted = false,
}: {
  className?: string;
  painted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {painted ? (
            <span
              className="hud-icon"
              style={{ backgroundPosition: "33.333% 50%" }}
              aria-hidden="true"
            />
          ) : (
            <BookOpen className="size-4" />
          )}
          <span>How to play</span>
        </button>
      </DialogTrigger>
      <DialogContent className="guide-dialog max-w-2xl">
        <DialogHeader>
          <p className="portal-eyebrow">The warband handbook</p>
          <DialogTitle className="font-display text-2xl text-primary">
            Strategy before the first strike.
          </DialogTitle>
          <DialogDescription>
            Build your team, choose its formation, then watch the battle play out automatically.
          </DialogDescription>
        </DialogHeader>
        <ol className="guide-steps">
          <li>
            <Shield />
            <div>
              <h3>01 · Read the battlefield</h3>
              <p>
                Check the mana cap, available Banners, and battle rules. Your commander and troops
                share one mana budget.
              </p>
            </div>
          </li>
          <li>
            <WandSparkles />
            <div>
              <h3>02 · Assemble your warband</h3>
              <p>
                Choose a commander, then recruit troops from their Banner and eligible Wayfarers. The
                match rules decide the unit limit. Abilities are shared combat skills across all
                Banners.
              </p>
            </div>
          </li>
          <li>
            <Swords />
            <div>
              <h3>03 · Set your formation</h3>
              <p>
                Position 1 takes the hits. Steel attacks from positions 1–2; Shot cannot fire from
                position 1. Spell works anywhere and ignores armor, unless a battle rule changes it.
              </p>
            </div>
          </li>
        </ol>
        <div className="guide-note">
          <strong>Start in Practice.</strong> Try the full card pool against AI with no rating
          changes. Ranked uses cards in your collection; open packs to start collecting.
        </div>
        <div className="guide-actions">
          <Link
            to="/battle"
            onClick={() => setOpen(false)}
            className="btn-ornate btn-ornate-verdant"
          >
            Enter Practice <Swords className="size-4" />
          </Link>
          <Link to="/codex" onClick={() => setOpen(false)} className="play-small-button">
            Explore the Codex
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
