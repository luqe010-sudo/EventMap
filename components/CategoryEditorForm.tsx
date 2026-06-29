"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { AdminCategory } from "@/lib/admin-categories";
import * as LucideIcons from "lucide-react";
import CategoryIcon from "./CategoryIcon";

type CategoryEditorFormProps = {
  action: (formData: FormData) => Promise<void>;
  category?: AdminCategory | null;
  submitLabel: string;
};

// Filter valid icon names once outside of the render loop
const ALL_ICON_NAMES = Object.keys(LucideIcons).filter(
  (key) =>
    /^[A-Z]/.test(key) &&
    (typeof LucideIcons[key as keyof typeof LucideIcons] === "function" ||
      typeof LucideIcons[key as keyof typeof LucideIcons] === "object")
);

export default function CategoryEditorForm({
  action,
  category,
  submitLabel
}: CategoryEditorFormProps) {
  const [color, setColor] = useState(category?.color ?? "#64748b");
  const [selectedIcon, setSelectedIcon] = useState(category?.icon ?? "CircleHelp");
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter icons based on search
  const filteredIconNames = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return ALL_ICON_NAMES.slice(0, 100); // Limit initial view for performance
    return ALL_ICON_NAMES.filter((name) => name.toLowerCase().includes(term)).slice(0, 100);
  }, [search]);

  return (
    <form 
      action={action} 
      className="managementForm"
    >
      <input type="hidden" name="icon" value={selectedIcon} readOnly />

      <div className="formGrid">
        <label>
          Nazwa *
          <input name="name" required defaultValue={category?.name ?? ""} />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={category?.slug ?? ""} placeholder="generowany z nazwy" />
        </label>
      </div>

      <div className="formGrid">
        <label>
          Kolor
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              name="color"
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#64748b"
              style={{ flex: 1 }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: "42px",
                height: "42px",
                padding: "2px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                cursor: "pointer",
                background: "var(--bg-card)"
              }}
            />
            <span
              style={{
                display: "inline-block",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: color,
                border: "2px solid var(--border-strong)",
                flexShrink: 0
              }}
            />
          </div>
        </label>

        <div className="managementFormLabel">
          Ikona
          <div ref={containerRef} className={`iconSelectContainer ${isOpen ? "isOpen" : ""}`}>
            <div
              className="iconSelectTrigger"
              onClick={() => setIsOpen(!isOpen)}
            >
              <CategoryIcon iconName={selectedIcon} size={18} />
              <span>{selectedIcon}</span>
            </div>
            {isOpen && (
              <div className="iconSelectDropdown">
                <input
                  type="text"
                  className="iconSearchInput"
                  placeholder="Wyszukaj ikonę..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                <div className="iconOptionsList">
                  {filteredIconNames.map((name) => (
                    <div
                      key={name}
                      className={`iconOptionRow ${selectedIcon === name ? "isSelected" : ""}`}
                      onClick={() => {
                        setSelectedIcon(name);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    >
                      <CategoryIcon iconName={name} size={18} />
                      <span>{name}</span>
                    </div>
                  ))}
                  {filteredIconNames.length === 0 && (
                    <div style={{ padding: "12px", color: "var(--ink-muted)", textAlign: "center" }}>
                      Nie znaleziono ikon.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <label>
          Kolejność sortowania
          <input
            name="sort_order"
            type="number"
            min={0}
            defaultValue={category?.sort_order ?? ""}
            placeholder="np. 1, 2, 3…"
          />
        </label>
      </div>

      <div className="managementActions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
      </div>
    </form>
  );
}
