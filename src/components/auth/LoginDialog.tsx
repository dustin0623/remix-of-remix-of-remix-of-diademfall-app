import { useState } from "react";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuthStore } from "@/features/stores/auth.store";

export function LoginDialog({ label, triggerClassName }: { label?: string; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerClassName ? (
          <button type="button" className={triggerClassName}>{user ? "Account" : label ?? "Login"}</button>
        ) : (
          <Button size="lg">{user ? "Account" : label ?? "Login"}</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{user ? "Your account" : "Enter the Game"}</DialogTitle>
          <DialogDescription>
            {user ? "Your ranked rating and collection are saved to your account." : "Log in or create an account to save your rating and card collection."}
          </DialogDescription>
        </DialogHeader>
        <LoginPanel onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
