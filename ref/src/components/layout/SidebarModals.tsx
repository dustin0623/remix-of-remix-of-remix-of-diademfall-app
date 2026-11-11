import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bomb, BookOpen, Check, Copy, ExternalLink, Info, Loader2, Play, Send, User, Users, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/stores/auth.store";
import { useSettingsStore } from "@/features/stores/settings.store";
import { GAME_CONFIG } from "@/game/engine/config/GameConfig";
import { getReferralInfo } from "@/lib/game/profile/profile.functions";

/** Fill these in once the real accounts exist; empty = shown disabled. */
export const SOCIAL_LINKS = {
  x: "",
  telegram: "",
  docs: "/wiki",
};

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const LINKS = [
  { label: "X", value: "Follow announcements", href: SOCIAL_LINKS.x, icon: XIcon },
  { label: "Telegram", value: "Join the community", href: SOCIAL_LINKS.telegram, icon: Send },
  { label: "Documentation", value: "Read the guide", href: SOCIAL_LINKS.docs, icon: BookOpen },
];

function Header({ icon: Icon, title, desc }: { icon: typeof Info; title: string; desc?: string }) {
  return (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </DialogTitle>
      {desc && <DialogDescription>{desc}</DialogDescription>}
    </DialogHeader>
  );
}

export function AboutModal({
  children,
  open,
  onOpenChange,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const controlled = open !== undefined;
  return (
    <Dialog {...(controlled ? { open, onOpenChange } : {})}>
      {!controlled && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <Header icon={Info} title="About" desc="An idle bomber mining game on XRPL. Follow us and read the docs to get started." />
        <div className="space-y-2">
          {LINKS.map((l) => l.label === "Documentation" ? (
            <DialogClose key={l.label} asChild>
              <Link to="/wiki" className="flex min-h-11 items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <BookOpen className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">Documentation</p>
                  <p className="text-[11px] text-muted-foreground">Read the guide</p>
                </div>
              </Link>
            </DialogClose>
          ) : (
            <a
              key={l.label}
              href={l.href || undefined}
              target={l.href ? "_blank" : undefined}
              rel={l.href ? "noopener noreferrer" : undefined}
              aria-disabled={!l.href || undefined}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5 aria-disabled:pointer-events-none aria-disabled:opacity-60"
            >
              <l.icon className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{l.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{l.href ? l.value : "Coming soon"}</p>
              </div>
              {l.href && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Controlled = { open: boolean; onOpenChange: (o: boolean) => void };

export function ProfileModal({ open, onOpenChange }: Controlled) {
  const player = useAuthStore((s) => s.player);
  const address = player?.walletAddress ?? player?.username ?? "";
  const name = player?.username || "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <Header icon={User} title="Profile" />
        <div className="space-y-2 text-sm">
          <Row label="Name" value={name} />
          <Row label="Wallet" value={address} mono />
          <Row label="Network" value="XRPL · Xaman" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={mono ? "break-all font-mono text-[12px]" : "text-[13px] font-medium"}>{value}</p>
    </div>
  );
}

export function ReferralModal({ open, onOpenChange }: Controlled) {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const [info, setInfo] = useState<{ code: string; referred: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!open || !player || !token) return;
    let cancelled = false;
    setFailed(false);
    getReferralInfo({ data: { playerId: player.id, token } })
      .then((r) => { if (!cancelled) setInfo(r); })
      .catch(() => { if (!cancelled) { setFailed(true); toast.error("Could not load referrals"); } });
    return () => { cancelled = true; };
  }, [open, player?.id, token]);
  const code = info?.code ?? player?.referralCode ?? "";
  const link = code && origin ? `${origin}/?ref=${encodeURIComponent(code)}` : "";
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md [&>*]:min-w-0">
        <Header icon={Users} title="Referral" desc="Share your link. Players who join with it count as your referrals." />
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your code</p>
            <p className="mt-1 truncate font-mono text-lg font-bold">{code || "—"}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Players referred</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{info ? info.referred.toLocaleString("en-US") : failed ? "—" : <Loader2 className="size-5 animate-spin text-muted-foreground" />}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border/60 bg-card/60 p-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={link}>{link}</span>
          <Button size="sm" variant="outline" onClick={copy} disabled={!link} className="shrink-0 gap-1">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsModal({ open, onOpenChange }: Controlled) {
  const { soundOn, masterVolume, bombVolume, setSoundOn, setMasterVolume, setBombVolume } = useSettingsStore();
  const preview = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (preview.current) {
      preview.current.volume = GAME_CONFIG.EXPLOSION.SFX_VOLUME * 2 * (bombVolume / 100) * (masterVolume / 100);
      if (!open || !soundOn) preview.current.pause();
    }
  }, [open, soundOn, masterVolume, bombVolume]);
  useEffect(() => () => { preview.current?.pause(); }, []);
  const testBomb = () => {
    const audio = preview.current ?? new Audio("/game/audio/sfx/boom.wav");
    preview.current = audio;
    audio.volume = GAME_CONFIG.EXPLOSION.SFX_VOLUME * 2 * (bombVolume / 100) * (masterVolume / 100);
    audio.currentTime = 0;
    void audio.play().catch(() => toast.error("Sound could not play. Try again."));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hud-audio-modal">
        <DialogHeader>
          <span className="hud-window-eyebrow">MAKE IT SOUND RIGHT</span>
          <DialogTitle className="hud-window-title">Audio settings</DialogTitle>
          <DialogDescription className="hud-window-description">A little boom. Or a lot. Your call.</DialogDescription>
        </DialogHeader>
        <div className="hud-audio-toggle">
          <span className="hud-audio-symbol">{soundOn ? <Volume2 /> : <VolumeX />}</span>
          <div><strong>Game audio</strong><small>{soundOn ? "Sound is on" : "All sounds muted"}</small></div>
          <Switch checked={soundOn} onCheckedChange={setSoundOn} aria-label="Sounds" />
        </div>
        <div className="hud-audio-channel" data-muted={!soundOn}>
          <div className="hud-audio-label"><label htmlFor="master-volume">Overall volume</label><output htmlFor="master-volume">{masterVolume}%</output></div>
          <p>Controls all game audio.</p>
          <input id="master-volume" type="range" min={0} max={100} step={1} value={masterVolume} disabled={!soundOn} onChange={(e) => setMasterVolume(Number(e.target.value))} />
          <div className="hud-audio-scale"><span>Silent</span><span>Full volume</span></div>
        </div>
        <div className="hud-audio-channel" data-muted={!soundOn}>
          <div className="hud-audio-label"><label htmlFor="bomb-volume"><Bomb size={16} /> Bomb effects</label><output htmlFor="bomb-volume">{bombVolume}%</output></div>
          <p>Fine-tune explosions within your overall volume.</p>
          <input id="bomb-volume" type="range" min={0} max={100} step={1} value={bombVolume} disabled={!soundOn} onChange={(e) => setBombVolume(Number(e.target.value))} />
          <button type="button" className="hud-audio-preview" disabled={!soundOn || masterVolume === 0 || bombVolume === 0} onClick={testBomb}><Play size={13} fill="currentColor" /> Test bomb sound</button>
        </div>
        <p className="hud-audio-saved"><Check size={14} /> Automatically saved on this device</p>
      </DialogContent>
    </Dialog>
  );
}
