"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, CarFront, HeartHandshake, MicVocal, Music2, PartyPopper, Sprout, Store, Theater, Trophy, UsersRound } from "lucide-react";
import type { EventItem } from "@/lib/events";
import { formatPolishDate } from "@/lib/date-format";
import { getEventCoverPhoto } from "@/lib/event-cover-media";

type VisualEvent = Pick<EventItem, "main_image_url" | "title" | "startDate" | "city" | "category" | "categorySlug" | "is_all_day">;

type Props = {
  event: VisualEvent;
  variant?: "card" | "detail" | "compact";
  decorative?: boolean;
  loading?: "lazy" | "eager";
  className?: string;
  imageClassName?: string;
  draggable?: boolean;
};

const categories = {
  koncerty: { Icon: Music2, accent: "#f2ba85", tint: "#51263e" },
  kultura: { Icon: Theater, accent: "#a8d7c5", tint: "#174a4c" },
  rodzinne: { Icon: UsersRound, accent: "#ffdaa1", tint: "#77502a" },
  sport: { Icon: Trophy, accent: "#a9cee9", tint: "#244d73" },
  mecze: { Icon: Trophy, accent: "#bde1b9", tint: "#29523e" },
  targi: { Icon: Store, accent: "#e7c0de", tint: "#663b60" },
  imprezy: { Icon: PartyPopper, accent: "#dcc5ff", tint: "#46316a" },
  festiwale: { Icon: Music2, accent: "#f2c69c", tint: "#774538" },
  festyny: { Icon: PartyPopper, accent: "#f7d598", tint: "#7d4c2d" },
  "stand-up": { Icon: MicVocal, accent: "#f0c0b0", tint: "#703c40" },
  kabaret: { Icon: MicVocal, accent: "#f0c0b0", tint: "#703c40" },
  charytatywne: { Icon: HeartHandshake, accent: "#d4dcb4", tint: "#4e6240" },
  motoryzacja: { Icon: CarFront, accent: "#b9d5e7", tint: "#344c64" },
  dozynki: { Icon: Sprout, accent: "#e8d3a3", tint: "#5c6034" },
  inne: { Icon: CalendarDays, accent: "#c4d6e1", tint: "#354f5d" }
};

/** A real poster stays intact; unavailable artwork becomes a factual editorial cover. */
export default function EventVisual({ event, variant = "card", decorative = true, loading = "lazy", className = "", imageClassName = "", draggable }: Props) {
  const source = event.main_image_url?.trim() || "";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [failedBackdrop, setFailedBackdrop] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const backdrop = useRef<HTMLImageElement>(null);
  const contextualPhoto = getEventCoverPhoto(event);
  const photo = contextualPhoto && failedBackdrop !== contextualPhoto.url ? contextualPhoto : undefined;
  useEffect(() => {
    // A cached error may have fired before React hydrated the server-rendered image.
    if (source && image.current?.complete && image.current.naturalWidth === 0) setFailedSource(source);
  }, [source]);
  useEffect(() => {
    if (contextualPhoto && backdrop.current?.complete && backdrop.current.naturalWidth === 0) setFailedBackdrop(contextualPhoto.url);
  }, [contextualPhoto]);
  const hasImage = Boolean(source && failedSource !== source);
  const palette = categories[event.categorySlug as keyof typeof categories] ?? categories.inne;
  const Icon = palette.Icon;
  const date = formatPolishDate(event.startDate, { day: "numeric", month: "short", year: "numeric" });
  const time = event.is_all_day ? "Cały dzień" : formatPolishDate(event.startDate, { hour: "2-digit", minute: "2-digit" });
  const label = hasImage ? `Grafika wydarzenia: ${event.title}` : `${event.title}. ${date}, ${time}. ${event.city || "Polska"}.${photo ? " Zdjęcie ilustracyjne." : ""}`;
  const style = { "--event-visual-accent": palette.accent, "--event-visual-tint": palette.tint } as CSSProperties;

  return (
    <div className={`eventVisual eventVisual--${variant} ${hasImage ? "eventVisual--image" : `eventVisual--cover${photo ? " eventVisual--photo" : ""}`} ${className}`.trim()}
      style={style} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative ? true : undefined}>
      {hasImage ? (
        <img ref={image} src={source} alt="" className={`eventVisualImage ${imageClassName}`.trim()} loading={loading} draggable={draggable}
          onError={() => setFailedSource(source)} />
      ) : (
        <div className="eventVisualCover">
          {photo ? <img ref={backdrop} className="eventVisualBackdrop" src={photo.url} alt="" width={1200} height={800} loading={loading} decoding="async" draggable={draggable}
            onError={() => setFailedBackdrop(photo.url)} /> : null}
          <span className="eventVisualOrbit" />
          <Icon className="eventVisualSymbol" strokeWidth={1.1} aria-hidden="true" />
          <div className="eventVisualEyebrow"><Icon size={14} strokeWidth={1.8} aria-hidden="true" /><span>{event.category}</span>
            {photo ? <span className="eventVisualImageNote">Zdjęcie ilustracyjne</span> : null}
          </div>
          <div className="eventVisualHeadline">{event.title}</div>
          <div className="eventVisualFooter"><span>{date}<span className="eventVisualTime"> · {time}</span></span><span className="eventVisualCity">{event.city || "Polska"}</span>
            {photo && variant === "detail" ? <span className="eventVisualPhotoCredit">Fot. {photo.author} · {photo.source.includes("pexels.com") ? "Pexels" : "Unsplash"}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
