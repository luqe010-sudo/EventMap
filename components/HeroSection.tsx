"use client";

import type { EventCategory } from "@/lib/events";

type HeroSectionProps = {
  eventCount: number;
  onSelectCategory: (category: EventCategory | "Wszystkie") => void;
  onSelectFree: () => void;
  onSelectDateFilter: (filter: "today" | "weekend") => void;
};

const quickTiles = [
  { icon: "heart", label: "Dla mnie", action: "category" as const, value: "Kultura" },
  { icon: "child", label: "Dla dzieci", action: "category" as const, value: "Rodzina" },
  { icon: "calendar", label: "Na weekend", action: "date" as const, value: "weekend" },
  { icon: "gift", label: "Za darmo", action: "free" as const, value: "" },
  { icon: "bolt", label: "Na dziś", action: "date" as const, value: "today" },
];

export default function HeroSection({ eventCount, onSelectCategory, onSelectFree, onSelectDateFilter }: HeroSectionProps) {
  return (
    <section className="heroSection">
      <div className="heroLeft">
        <h1 className="heroTitle">
          Odkrywaj wydarzenia<br />
          w swojej okolicy.
        </h1>
        <p className="heroSubtitle">
          Koncerty, festyny, dożynki, sport i kultura w jednej mapie.<br />
          Wybierz miasto, kategorię i znajdź coś dla siebie.
        </p>
      </div>
      <div className="heroRight">
        <div className="heroCard">
          <p className="heroCardTitle">
            Nie wiesz co robić? Pokaż nam swój klimat<br />
            a my znajdziemy coś dla Ciebie!
          </p>
          <div className="heroQuickTiles">
            {quickTiles.map((tile) => (
              <button
                key={tile.label}
                type="button"
                className="heroQuickTile"
                onClick={() => {
                  if (tile.action === "category") onSelectCategory(tile.value as EventCategory);
                  else if (tile.action === "free") onSelectFree();
                  else if (tile.action === "date") onSelectDateFilter(tile.value as "today" | "weekend");
                }}
              >
                <span className={`heroQuickTileIcon heroQuickTileIcon-${tile.icon}`}>
                  <QuickTileIcon name={tile.icon} />
                </span>
                <span className="heroQuickTileLabel">{tile.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Background decoration */}
      <div className="heroDecoration">
        <div className="heroShape heroShape1" />
        <div className="heroShape heroShape2" />
      </div>
    </section>
  );
}

function QuickTileIcon({ name }: { name: string }) {
  if (name === "heart") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 27s-9.5-5.7-11.8-12.1C2.8 11 5.2 7.2 9 7.2c2.2 0 3.8 1.1 5 2.8 1.2-1.7 2.8-2.8 5-2.8 3.8 0 6.2 3.8 4.8 7.7C21.5 21.3 16 27 16 27Z" fill="#fff" stroke="#252120" strokeWidth="2" />
        <path d="M21.1 6.5a4 4 0 1 1-5.7 5.7 4 4 0 0 1 5.7-5.7Z" fill="#ff482b" />
      </svg>
    );
  }

  if (name === "child") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16.5" r="9.2" fill="#ffd478" stroke="#252120" strokeWidth="1.7" />
        <path d="M9.8 13.1c.4-5 4.2-8 8.6-6.6 2.8.9 4.1 3.3 3.7 6.6-2.1-2-4.2-2.5-6.3-1.3-2.2 1.2-3.9 1.6-6 .8Z" fill="#f6a126" />
        <circle cx="12.8" cy="16.8" r="1.1" fill="#252120" />
        <circle cx="19.2" cy="16.8" r="1.1" fill="#252120" />
        <path d="M13 21.1c1.7 1.3 4.3 1.3 6 0" fill="none" stroke="#252120" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6.5" y="7.5" width="19" height="18" rx="3" fill="#e8f2ff" stroke="#2677d9" strokeWidth="1.8" />
        <path d="M6.5 13h19" stroke="#2677d9" strokeWidth="1.8" />
        <path d="M11 5.5v4M21 5.5v4" stroke="#2677d9" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17h2.5M17.5 17H20M12 21h2.5M17.5 21H20" stroke="#2677d9" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "gift") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="13" width="18" height="13" rx="2" fill="#e5f8ec" stroke="#1b8b4b" strokeWidth="1.8" />
        <path d="M6 13h20v-4H6v4ZM16 9v17" stroke="#1b8b4b" strokeWidth="1.8" />
        <path d="M16 9c-3.4-.7-5.1-2-4.7-3.5.4-1.3 2.2-1.2 3.3.2.6.8 1 1.9 1.4 3.3Zm0 0c3.4-.7 5.1-2 4.7-3.5-.4-1.3-2.2-1.2-3.3.2-.6.8-1 1.9-1.4 3.3Z" fill="#fff7d7" stroke="#1b8b4b" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M18.1 3 8.5 17.2h7L13.9 29l9.6-15.2h-7L18.1 3Z" fill="#ffc038" stroke="#252120" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
