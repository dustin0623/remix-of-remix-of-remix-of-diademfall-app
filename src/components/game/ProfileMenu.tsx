import { Link, useNavigate } from "@tanstack/react-router";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, ChevronDown, Landmark, LogOut, ReceiptText, Settings, User } from "lucide-react";
import { HudIcon } from "@/components/portal/HudIcon";
import { supabase } from "@/integrations/supabase/client";

const LINKS = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/treasury", label: "Treasury", icon: Landmark },
  { to: "/activity", label: "Activity", icon: ReceiptText },
  { to: "/codex", label: "Codex", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

/** Signed-in avatar block in the header; opens the account menu. */
export function ProfileMenu({ name, detail }: { name: string; detail: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="hud-profile hud-profile-button" aria-label="Account menu">
        <HudIcon name="ranked" className="hud-profile-emblem" />
        <span className="hud-profile-name">
          <strong>{name}</strong>
          <span>{detail}</span>
        </span>
        <ChevronDown className="hud-profile-chevron size-3" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="hud-profile-menu">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <DropdownMenu.Item key={to} asChild>
              <Link to={to}>
                <Icon className="size-4" /> {label}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="hud-profile-menu-sep" />
          <DropdownMenu.Item className="hud-profile-menu-logout" onSelect={() => void signOut()}>
            <LogOut className="size-4" /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
