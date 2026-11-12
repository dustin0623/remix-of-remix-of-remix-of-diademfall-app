import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function CommerceHeader({
  section,
}: {
  section: "packs" | "cards" | "open" | "collection";
}) {
  return (
    <div className="commerce-header">
      <Link to="/" className="portal-back">
        <ArrowLeft className="size-3" /> War Room
      </Link>
      <h1>
        {section === "collection"
          ? "My Collection"
          : section === "cards"
            ? "Card Market"
            : section === "packs"
              ? "Pack Shop"
              : "Open Packs"}
      </h1>
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
        <Link
          to="/market"
          search={{ section: "collection" }}
          className={section === "collection" ? "selected" : ""}
        >
          Collection
        </Link>
      </nav>
    </div>
  );
}
