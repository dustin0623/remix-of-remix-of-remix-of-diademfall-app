import { useEffect, useState } from "react";
import { BookOpen, Search, X } from "lucide-react";

export const WIKI_SECTIONS = [
  {
    id: "getting-started",
    label: "Start playing",
    group: "Get started",
    keywords: "connect xaman wallet login sound audio volume deploy",
  },
  {
    id: "heroes",
    label: "Heroes & rarity",
    group: "Inside the mine",
    keywords: "attributes stats power speed stamina range bombs level upgrade odds",
  },
  {
    id: "combat",
    label: "Bombs & stages",
    group: "Inside the mine",
    keywords: "blasts damage mining bushes map offline",
  },
  {
    id: "chests",
    label: "Chest rewards",
    group: "Inside the mine",
    keywords: "health hp coins gold treasure chances",
  },
  {
    id: "energy",
    label: "Energy & recovery",
    group: "Inside the mine",
    keywords: "stamina rest recharge deployment hours",
  },
  {
    id: "skills",
    label: "Passive skills",
    group: "Inside the mine",
    keywords: "quick rest conserve pierce bonus pay heavy impact",
  },
  {
    id: "houses",
    label: "Houses",
    group: "Build your world",
    keywords: "recovery slots registration demo nft villa",
  },
  {
    id: "economy",
    label: "Minting & economy",
    group: "Build your world",
    keywords: "shop cost price coins deposit withdraw payments wallet",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    group: "Build your world",
    keywords: "buy sell listing hold reserve trade payment",
  },
  {
    id: "profile",
    label: "Progress & profile",
    group: "Your account",
    keywords: "cosmetics xp level username avatar background referral leaderboard rankings",
  },
  {
    id: "saving",
    label: "Saving & fair play",
    group: "Your account",
    keywords: "sync session saved refresh tab device",
  },
  {
    id: "faq",
    label: "Questions & answers",
    group: "Your account",
    keywords: "help problem trouble sound audio volume",
  },
] as const;

export function WikiNavigation() {
  const [selected, setSelected] = useState<string>(WIKI_SECTIONS[0].id);
  const [query, setQuery] = useState("");
  const filtered = WIKI_SECTIONS.filter((s) =>
    `${s.label} ${s.keywords}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let active: string = WIKI_SECTIONS[0].id;
      for (const section of WIKI_SECTIONS) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= 165) active = section.id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8)
        active = "faq";
      setSelected(active);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const jump = (id: string) => {
    setSelected(id);
    window.location.hash = id;
    document.getElementById(id)?.focus({ preventScroll: true });
  };

  return (
    <aside className="wiki-sidebar">
      <div className="wiki-mobile-nav">
        <BookOpen size={16} />
        <label htmlFor="wiki-section" className="sr-only">
          Jump to chapter
        </label>
        <select id="wiki-section" value={selected} onChange={(e) => jump(e.target.value)}>
          {WIKI_SECTIONS.map((s, i) => (
            <option key={s.id} value={s.id}>
              {String(i + 1).padStart(2, "0")} · {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="wiki-desktop-nav">
        <span className="wiki-eyebrow">EXPLORE THE GUIDE</span>
        <div className="wiki-topic-finder">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label="Find a chapter"
            placeholder="Find a topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" aria-label="Clear topic search" onClick={() => setQuery("")}>
              <X size={13} />
            </button>
          )}
        </div>
        <nav aria-label="Wiki chapters">
          {filtered.map((s, i) => (
            <div key={s.id}>
              {(i === 0 || filtered[i - 1]?.group !== s.group) && (
                <p className="wiki-nav-group">{s.group}</p>
              )}
              <a
                href={`#${s.id}`}
                aria-current={selected === s.id ? "location" : undefined}
                onClick={() => setSelected(s.id)}
              >
                <span>{String(WIKI_SECTIONS.indexOf(s) + 1).padStart(2, "0")}</span>
                {s.label}
              </a>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="wiki-no-topics" role="status">
              No matching chapters. Try “energy”, “wallet” or “heroes”.
            </p>
          )}
        </nav>
        <p className="wiki-nav-footnote">
          Twelve chapters.
          <br />
          One better-prepared crew.
        </p>
      </div>
    </aside>
  );
}
