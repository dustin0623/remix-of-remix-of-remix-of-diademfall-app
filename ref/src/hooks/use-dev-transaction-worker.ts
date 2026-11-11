import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runTransactionBatch } from "@/lib/smart-contract/worker.functions";

/** Dev only: while the app is open, process the mock transaction queue on an interval. */
export function useDevTransactionWorker(intervalMs = 5000, enabled = true) {
  const run = useServerFn(runTransactionBatch);
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    let busy = false;
    let failures = 0;
    const id = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await run();
        failures = 0;
      } catch (e) {
        failures += 1;
        // A stale tab or an out-of-date dev server will reject every call; stop
        // hammering it instead of firing a failing request every interval.
        if (failures >= 3) {
          clearInterval(id);
          console.warn("dev transaction worker: stopped after 3 consecutive failures", e);
          return;
        }
        console.warn("dev transaction worker:", e);
      } finally {
        busy = false;
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [run, intervalMs, enabled]);
}
