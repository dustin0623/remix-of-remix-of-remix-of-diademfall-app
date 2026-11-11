import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Full-bleed painted band used at the top of game pages (Splinterlands-style), fading into the page background. */
export function PageHero({ art, eyebrow, title, subtitle, children, className, pos = "50% 40%" }: {
  art: string; eyebrow?: ReactNode; title?: ReactNode; subtitle?: ReactNode; children?: ReactNode; className?: string; pos?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden border-b border-primary/20", className)}>
      <img src={art} alt="" width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: pos }} />
      <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/40 to-background" />
      <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
        {(eyebrow || title || subtitle) && (
          <div className="mb-8 text-center">
            {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.35em] text-arcane">{eyebrow}</div>}
            {title && <h1 className="title-portal mt-2 text-4xl md:text-6xl">{title}</h1>}
            {subtitle && <p className="mx-auto mt-3 max-w-2xl text-foreground/85">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Slanted dark tab strip, like the Frontier/Modern/Wild format switcher. */
export function SegmentTabs<T extends string>({ options, value, onChange, label, className }: {
  options: { id: T; name: string }[]; value: T; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="tablist" aria-label={label}
      className={cn("inline-flex flex-wrap items-center gap-1 border border-primary/30 bg-night/85 p-1 [clip-path:polygon(0.75rem_0,calc(100%-0.75rem)_0,100%_50%,calc(100%-0.75rem)_100%,0.75rem_100%,0_50%)] px-4", className)}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cn("px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition",
            value === o.id ? "bg-verdant text-primary-foreground" : "text-muted-foreground hover:text-primary")}>
          {o.name}
        </button>
      ))}
    </div>
  );
}
