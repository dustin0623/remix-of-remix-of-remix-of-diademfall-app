import type { ReactNode } from "react";
import { BookOpen, ChevronRight, LogOut, ReceiptText, Star, User, Volume2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type AccountAction = "profile" | "withdraw" | "history" | "wiki" | "settings" | "signout";

const ITEMS: { id: AccountAction; label: string; description: string; icon: typeof User }[] = [
  { id: "profile", label: "Your profile", description: "Progress, appearance & house", icon: User },
  { id: "history", label: "Account history", description: "Every gold change, before & after", icon: ReceiptText },
  { id: "wiki", label: "Game guide", description: "Everything about the mine", icon: BookOpen },
  { id: "settings", label: "Audio settings", description: "Master volume & bomb effects", icon: Volume2 },
];

/** Shared account window for the live header and Test UI. */
export function AccountMenuModal({ open, onOpenChange, trigger, onSelect, name, avatarUrl, level }: {
  open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode; onSelect: (action: AccountAction) => void;
  name: string; avatarUrl: string; level: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="hud-account-modal">
        <div className="hud-account-heading">
          <span className="hud-window-eyebrow">YOUR ADVENTURE</span>
          <DialogTitle className="hud-account-title">Account</DialogTitle>
          <DialogDescription className="sr-only">Your profile, account history, game guide and audio settings.</DialogDescription>
        </div>
        <div className="hud-account-identity">
          <img src={avatarUrl} alt="" width={64} height={64} />
          <div><strong>{name}</strong><span><Star size={12} fill="currentColor" /> Level {level}</span></div>
        </div>
        <nav className="hud-account-list" aria-label="Account">
          {ITEMS.map(({ id, label, description, icon: Icon }) => (
            <button key={id} type="button" className="hud-account-item"
              onClick={() => { onOpenChange(false); onSelect(id); }}>
              <span className="hud-account-item-icon"><Icon /></span>
              <span className="hud-account-item-copy"><strong>{label}</strong><small>{description}</small></span>
              <ChevronRight className="hud-account-chevron" />
            </button>
          ))}
        </nav>
        <button type="button" className="hud-account-disconnect" onClick={() => { onOpenChange(false); onSelect("signout"); }}>
          <LogOut size={16} /> Disconnect wallet
        </button>
      </DialogContent>
    </Dialog>
  );
}
