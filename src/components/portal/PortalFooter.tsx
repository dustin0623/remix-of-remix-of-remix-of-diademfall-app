import { Link } from "@tanstack/react-router";

export function PortalFooter() {
  return (
    <footer className="portal-footer">
      <Link to="/" aria-label="Diademfall home">
        <img src="/assets/HUD/logo.png" alt="Diademfall" width="900" height="450" />
      </Link>
      <nav aria-label="Footer">
        <Link to="/battle">Practice</Link>
        <Link to="/ranked">Ranked</Link>
        <Link to="/codex">Codex</Link>
        <Link to="/wallet">Wallet</Link>
        <Link to="/activity">Activity</Link>
        <Link to="/treasury">Treasury</Link>
      </nav>
      <p>© {new Date().getFullYear()} Diademfall. All rights reserved.</p>
    </footer>
  );
}
