import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HudIcon } from "./HudIcon";

export function ChallengeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="challenge-dialog">
        <HudIcon name="challenge" />
        <DialogHeader>
          <DialogTitle>Challenge a Friend</DialogTitle>
          <DialogDescription>Coming soon</DialogDescription>
        </DialogHeader>
        <p>
          Direct player challenges are on their way. Until then, sharpen your strategy in Practice
          or find a rival in Ranked.
        </p>
        <div className="challenge-dialog-actions">
          <Link to="/battle" onClick={() => onOpenChange(false)}>
            Practice
          </Link>
          <Link to="/ranked" onClick={() => onOpenChange(false)}>
            Ranked
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
