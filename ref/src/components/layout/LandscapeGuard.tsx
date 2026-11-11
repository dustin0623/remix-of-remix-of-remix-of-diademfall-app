import { RotateCw, Smartphone } from "lucide-react";

/** The simulation pauses in portrait; browsing and navigation remain available. */
export function LandscapeGuard() {
  return (
    <div className="mine-orientation" role="status">
      <div className="mine-orientation-art" aria-hidden="true"><Smartphone /><RotateCw /></div>
      <h2>Turn your device to mine</h2>
      <p>Your crew is paused in portrait. You can still browse your heroes, shop and account.</p>
    </div>
  );
}
