"use client";

import { useState } from "react";

type Props = {
  text?: string | null;
};

export default function ExpandableDescription({ text }: Props) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = splitDescription(text);
  const isLong = paragraphs.length > 3 || (text?.length ?? 0) > 500;

  return (
    <div className="edExpandWrap">
      <div
        className={`edExpandContent ${!expanded && isLong ? "edExpandContentCollapsed" : ""}`}
      >
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {!expanded && isLong ? <div className="edExpandGradient" /> : null}
      </div>
      {isLong ? (
        <button
          type="button"
          className="edExpandToggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Pokaż mniej" : "Pokaż więcej"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: expanded ? "rotate(180deg)" : undefined,
              transition: "transform 0.2s",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function splitDescription(value?: string | null) {
  const paragraphs =
    value
      ?.split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean) ?? [];
  return paragraphs.length
    ? paragraphs
    : ["Brak szczegółowego opisu wydarzenia."];
}
