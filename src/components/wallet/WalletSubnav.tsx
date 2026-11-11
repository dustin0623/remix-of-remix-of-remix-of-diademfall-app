import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Sub-header shared by the Wallet and Currency Activity pages. */
export function WalletSubnav({ section }: { section: "wallet" | "activity" }) {
  return (
    <div className="commerce-header">
      <Link to="/" className="portal-back">
        <ArrowLeft className="size-3" /> Back
      </Link>
      <h1>{section === "wallet" ? "Wallet" : "Currency Activity"}</h1>
      <nav aria-label="Wallet navigation">
        <Link to="/wallet" className={section === "wallet" ? "selected" : ""}>
          Deposit &amp; Withdraw
        </Link>
        <Link to="/activity" className={section === "activity" ? "selected" : ""}>
          Activity
        </Link>
      </nav>
    </div>
  );
}
