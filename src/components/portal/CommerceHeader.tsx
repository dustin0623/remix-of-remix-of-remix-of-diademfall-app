import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function CommerceHeader({ section }: { section: "packs" | "cards" | "open" }) {
  return (
    <div className="commerce-header">
      <Link to="/" className="portal-back">
        <ArrowLeft className="size-3" /> Back
      </Link>
      <h1>{section === "cards" ? "Cards" : section === "packs" ? "Packs" : "Open Packs"}</h1>
      <nav aria-label="Market navigation">
        <Link to="/shop" className={section === "packs" ? "selected" : ""}>
          Packs
        </Link>
        <Link to="/market" className={section === "cards" ? "selected" : ""}>
          Cards
        </Link>
        <Link to="/open" className={section === "open" ? "selected" : ""}>
          Open
        </Link>
      </nav>
    </div>
  );
}
