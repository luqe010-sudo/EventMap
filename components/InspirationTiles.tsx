"use client";

import type { EventCategory } from "@/lib/events";

type InspirationTilesProps = {
  onSelectCategory: (category: EventCategory | "Wszystkie") => void;
  onSelectFree: () => void;
};

const tiles = [
  { emoji: "❤️", label: "Dla par", category: "Kultura" as EventCategory, gradient: "linear-gradient(135deg, #fecdd3, #fda4af)" },
  { emoji: "👨‍👩‍👧", label: "Dla rodzin", category: "Rodzina" as EventCategory, gradient: "linear-gradient(135deg, #c7d2fe, #a5b4fc)" },
  { emoji: "🎵", label: "Muzyka", category: "Koncert" as EventCategory, gradient: "linear-gradient(135deg, #ddd6fe, #c4b5fd)" },
  { emoji: "🏎️", label: "Motoryzacja", category: "Motoryzacja" as EventCategory, gradient: "linear-gradient(135deg, #e0e7ff, #818cf8)" },
  { emoji: "🎨", label: "Kultura", category: "Kultura" as EventCategory, gradient: "linear-gradient(135deg, #ccfbf1, #5eead4)" },
  { emoji: "⚽", label: "Sport", category: "Sport" as EventCategory, gradient: "linear-gradient(135deg, #bfdbfe, #60a5fa)" },
  { emoji: "🎪", label: "Festyny", category: "Festyn" as EventCategory, gradient: "linear-gradient(135deg, #fef3c7, #fbbf24)" },
  { emoji: "🆓", label: "Za darmo", category: null as unknown as EventCategory, gradient: "linear-gradient(135deg, #d1fae5, #34d399)" }
];

export default function InspirationTiles({ onSelectCategory, onSelectFree }: InspirationTilesProps) {
  return (
    <section className="inspirationSection">
      <div className="inspirationHeader">
        <h2 className="inspirationTitle">Nie wiesz czego szukasz?</h2>
        <p className="inspirationSubtitle">Wybierz to, co Cię inspiruje</p>
      </div>
      <div className="inspirationGrid">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className="inspirationTile"
            style={{ background: tile.gradient }}
            onClick={() => {
              if (tile.label === "Za darmo") {
                onSelectFree();
              } else {
                onSelectCategory(tile.category);
              }
            }}
          >
            <span className="inspirationEmoji">{tile.emoji}</span>
            <span className="inspirationLabel">{tile.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
