import { useEffect, useState } from "react";
import { timeLeft } from "@/game/divisions";

export function SeasonClock({ endsAt }: { endsAt: string | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!endsAt || now === null) return null;
  return (
    <span className="season-clock">
      Ends in <strong>{timeLeft(endsAt, now)}</strong>
    </span>
  );
}
