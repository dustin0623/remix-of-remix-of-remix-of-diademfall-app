import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Read-only value with a copy button (addresses, memo tags). */
export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-stretch gap-1">
        <code className="min-w-0 flex-1 break-all rounded border border-border bg-background/60 px-2.5 py-2 text-xs">{value}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="rounded border border-border px-2.5 text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          {copied ? <Check className="size-4 text-verdant" /> : <Copy className="size-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
