import { useRouterState } from "@tanstack/react-router";
import "@/styles/page-transitions.css";

/** Themed full-area loader shown until a page's data is ready. */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="pt-loader" role="status" aria-live="polite">
      <span className="pt-loader-gem" aria-hidden />
      <span className="pt-loader-label">{label}</span>
    </div>
  );
}

/** Gold shimmer line across the top while a navigation is in progress. */
export function RouteProgress() {
  const loading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });
  return <div className="pt-progress" data-active={loading || undefined} aria-hidden />;
}

/** Fades page content in each time the rendered route changes. */
export function PageFade({ id, children }: { id: string; children: React.ReactNode }) {
  return <div key={id} className="pt-fade">{children}</div>;
}
