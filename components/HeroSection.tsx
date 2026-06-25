"use client";

import { Baby, CalendarDays, Gift, Heart, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EventCategory } from "@/lib/events";

type HeroSectionProps = {
  eventCount: number;
  onSelectCategory: (category: EventCategory | "Wszystkie") => void;
  onSelectFree: () => void;
  onSelectDateFilter: (filter: "today" | "weekend") => void;
  title?: string;
  subtitle?: string;
};

const quickTiles = [
  { icon: "heart", label: "Dla mnie", action: "category" as const, value: "Kultura" },
  { icon: "child", label: "Dla dzieci", action: "category" as const, value: "Rodzina" },
  { icon: "calendar", label: "Na weekend", action: "date" as const, value: "weekend" },
  { icon: "gift", label: "Za darmo", action: "free" as const, value: "" },
  { icon: "bolt", label: "Na dziś", action: "date" as const, value: "today" },
];

const quickTileIcons: Record<string, LucideIcon> = {
  heart: Heart,
  child: Baby,
  calendar: CalendarDays,
  gift: Gift,
  bolt: Zap,
};

export default function HeroSection({ eventCount, onSelectCategory, onSelectFree, onSelectDateFilter, title, subtitle }: HeroSectionProps) {
  return (
    <section className="heroSection">
      <div className="heroLeft">
        <h1 className="heroTitle">
          {title || (
            <>
              Odkrywaj wydarzenia<br />
              w swojej okolicy<span className="heroTitleAccent">.</span>
            </>
          )}
        </h1>
        <p className="heroSubtitle">
          {subtitle || (
            <>
              Koncerty, festyny, dożynki, sport i kultura w jednej mapie.<br />
              Wybierz miasto, kategorię i znajdź coś dla siebie.
            </>
          )}
        </p>
      </div>
      <div className="heroRight">
        <div className="heroCard">
          <p className="heroCardTitle">
            Nie wiesz co robić? Pokaż nam swój klimat<br />
            a my znajdziemy coś dla Ciebie!
          </p>
          <div className="heroQuickTiles">
            {quickTiles.map((tile) => {
              const Icon = quickTileIcons[tile.icon];

              return (
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
                    <Icon size={29} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <span className="heroQuickTileLabel">{tile.label}</span>
                </button>
              );
            })}
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
