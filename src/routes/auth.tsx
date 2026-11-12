import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { GameHeader } from "@/components/game/GameHeader";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { useAuthStore } from "@/features/stores/auth.store";
import { ARTWORK } from "@/lib/artwork";
import logo from "@/assets/portal/logo.png";

const safePath = (p: string | undefined) =>
  p && p.startsWith("/") && !p.startsWith("//") ? p : "/";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — Diademfall" },
      {
        name: "description",
        content:
          "Log in or create a Diademfall account to play ranked matches and keep your rating.",
      },
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
  const destination = target.split("?")[0];
  const purpose =
    destination === "/shop"
      ? "build your collection"
      : destination === "/open"
        ? "open your packs"
        : destination === "/market"
          ? target.includes("section=collection")
            ? "manage your collection"
            : "trade cards"
          : destination === "/wallet"
            ? "manage your wallet"
            : destination === "/activity"
              ? "view your activity"
              : destination === "/leaderboard"
                ? "explore the leaderboard"
                : "enter the arena";
  useEffect(() => {
    if (user && redirect) void navigate({ to: target, replace: true });
  }, [user, redirect, target, navigate]);
  return (
    <div className="portal-page flex min-h-screen flex-col">
      <GameHeader />
      <main className="relative flex flex-1 justify-center">
        <img
          src={ARTWORK.backgrounds.gate}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-night/30" />
        <div className="relative flex w-full max-w-xl flex-col items-center border-x border-primary/20 bg-night/85 px-6 pb-16 pt-8 backdrop-blur-sm sm:px-16">
          <img
            src={logo}
            alt="Diademfall"
            width={900}
            height={450}
            className="w-full max-w-sm drop-shadow-[0_8px_24px_oklch(0_0_0/70%)]"
          />
          <h1 className="mb-3 mt-2 text-center font-display text-xl font-bold text-primary">
            Sign in to {purpose}
          </h1>
          <p className="mb-7 text-center text-sm text-foreground/80">
            Keep your cards, saved teams, and ranked progress together in one account.
          </p>
          <div className="w-full max-w-xs">
            <LoginPanel onDone={() => void navigate({ to: target, replace: true })} />
          </div>
          <Link to="/battle" className="mt-7 text-sm text-primary hover:underline">
            Just exploring? Try free Practice →
          </Link>
        </div>
      </main>
    </div>
  );
}
