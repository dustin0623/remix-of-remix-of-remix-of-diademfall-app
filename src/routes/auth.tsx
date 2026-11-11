import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { GameHeader } from "@/components/game/GameHeader";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { useAuthStore } from "@/features/stores/auth.store";
import gate from "@/assets/portal/gate.jpg";
import logo from "@/assets/portal/logo.png";

const safePath = (p: string | undefined) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/");

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — Diademfall" },
      { name: "description", content: "Log in or create a Diademfall account to play ranked matches and keep your rating." },
      { property: "og:title", content: "Sign in — Diademfall" },
      { property: "og:description", content: "Log in or create an account to play ranked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const target = safePath(redirect);
  useEffect(() => { if (user && redirect) void navigate({ to: target, replace: true }); }, [user, redirect, target, navigate]);
  return (
    <div className="flex min-h-screen flex-col">
      <GameHeader />
      <main className="relative flex flex-1 justify-center">
        <img src={gate} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-night/30" />
        <div className="relative flex w-full max-w-xl flex-col items-center border-x border-primary/20 bg-night/85 px-6 pb-16 pt-8 backdrop-blur-sm sm:px-16">
          <img src={logo} alt="Diademfall" width={900} height={450} className="w-full max-w-sm drop-shadow-[0_8px_24px_oklch(0_0_0/70%)]" />
          <p className="mb-8 mt-2 text-center text-sm text-foreground/80">Sign in to play ranked matches, save your teams and climb the ladder.</p>
          <div className="w-full max-w-xs">
            <LoginPanel onDone={() => void navigate({ to: target, replace: true })} />
          </div>
        </div>
      </main>
    </div>
  );
}
