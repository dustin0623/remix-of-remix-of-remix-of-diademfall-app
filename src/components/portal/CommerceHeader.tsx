import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const titles = {
  packs: "Pack Market",
  "market-cards": "Card Market",
  "item-cards": "My Cards",
  others: "Other Items",
} as const;

export function CommerceHeader({ section }: { section: keyof typeof titles }) {
  const inventory = section === "item-cards" || section === "others";
  return (
    <div className="commerce-header">
      <Link to="/" className="portal-back">
        <ArrowLeft className="size-3" /> War Room
      </Link>
      <h1>{titles[section]}</h1>
      {inventory ? (
        <nav aria-label="Items navigation">
          <Link
            to="/items"
            search={{ section: "cards" }}
            aria-current={section === "item-cards" ? "page" : undefined}
            className={section === "item-cards" ? "selected" : ""}
          >
            Cards
          </Link>
          <Link
            to="/items"
            search={{ section: "others" }}
            aria-current={section === "others" ? "page" : undefined}
            className={section === "others" ? "selected" : ""}
          >
            Others
          </Link>
        </nav>
      ) : (
        <nav aria-label="Market navigation">
          <Link
            to="/market"
            search={{ section: "packs" }}
            aria-current={section === "packs" ? "page" : undefined}
            className={section === "packs" ? "selected" : ""}
          >
            Packs
          </Link>
          <Link
            to="/market"
            search={{ section: "buy" }}
            aria-current={section === "market-cards" ? "page" : undefined}
            className={section === "market-cards" ? "selected" : ""}
          >
            Cards
          </Link>
        </nav>
      )}
    </div>
  );
}
