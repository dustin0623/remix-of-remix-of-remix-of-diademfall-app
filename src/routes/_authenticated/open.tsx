import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/open")({
  beforeLoad: () => {
    throw redirect({ to: "/items", search: { section: "others" }, replace: true });
  },
});
