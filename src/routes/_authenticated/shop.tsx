import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/shop")({
  beforeLoad: () => {
    throw redirect({ to: "/market", search: { section: "packs" }, replace: true });
  },
});
