"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { MapPin } from "lucide-react";
import EventCard from "@/components/EventCard";
import EventCardContent from "@/components/EventCardContent";
import type { EventWithDistance } from "@/lib/event-groups";
import { interpolateVenueDeckSlot, moveVenueDeckIndex, resolveVenueDeckIndex, venueDeckSlots, venueDeckSwipeDirection } from "@/lib/event-venue-deck";

type Props = {
  events: EventWithDistance[];
  venue: string | null;
  onOpenEvent?: (eventId: string) => void;
  onShowOnMap?: (eventId: string) => void;
};

type Gesture = { pointerId: number; x: number; y: number; axis: "pending" | "horizontal" | "vertical" };

export default function EventVenueDeck({ events, venue, onOpenEvent, onShowOnMap }: Props) {
  const id = useId();
  const stage = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState({ id: events[0]?.event.id ?? null, index: 0, direction: -1 as -1 | 1 });
  const [dragX, setDragX] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const suppressClickUntil = useRef(0);
  const ids = events.map(({ event }) => event.id);
  const eventsKey = ids.join("|");
  const index = resolveVenueDeckIndex(ids, selection.id, selection.index);
  const active = events[index];
  const activeId = active?.event.id;

  useEffect(() => {
    if (activeId == null) return;
    setSelection(previous => previous.id === activeId && previous.index === index ? previous : { ...previous, id: activeId, index });
  }, [activeId, index]);

  useEffect(() => {
    if (gesture.current?.axis === "horizontal") suppressClickUntil.current = Date.now() + 600;
    const pointerId = gesture.current?.pointerId;
    gesture.current = null;
    if (pointerId != null && stage.current?.hasPointerCapture(pointerId)) stage.current.releasePointerCapture(pointerId);
    setDragX(0);
  }, [eventsKey]);

  function preserveDeckFocus() {
    if (document.activeElement instanceof Element && stage.current?.contains(document.activeElement)
      && document.activeElement.closest(".eventVenueDeckLayer")) stage.current.focus({ preventScroll: true });
  }

  function advance(direction: -1 | 1) {
    if (events.length < 2) return;
    preserveDeckFocus();
    setSelection(previous => {
      const current = resolveVenueDeckIndex(ids, previous.id, previous.index);
      const next = moveVenueDeckIndex(current, direction, events.length);
      return { id: events[next].event.id, index: next, direction };
    });
  }

  function selectCard(eventId: string, position: number) {
    const next = ids.indexOf(eventId);
    if (next < 0) return;
    stage.current?.focus({ preventScroll: true });
    setSelection({ id: eventId, index: next, direction: position < 0 ? -1 : 1 });
  }

  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest("button, input, select, textarea, [role='button']")
      && !event.target.closest(".eventVenueDeckSelect")) return;
    suppressClickUntil.current = 0;
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, axis: "pending" };
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (event.buttons === 0) { finishGesture(event, true); return; }
    if (start.axis === "vertical") return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (start.axis === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10) return;
      if (Math.abs(deltaX) >= Math.abs(deltaY) * 1.35) {
        start.axis = "horizontal";
        event.currentTarget.setPointerCapture(event.pointerId);
      } else if (Math.abs(deltaY) > Math.abs(deltaX)) { start.axis = "vertical"; return; }
      else return;
    }
    event.preventDefault();
    setDragX(Math.max(-120, Math.min(120, deltaX)));
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    // Clear first: lostpointercapture must not cancel a completed move.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragX(0);
    if (start.axis !== "horizontal") return;
    suppressClickUntil.current = Date.now() + 600;
    if (cancelled) return;
    const direction = venueDeckSwipeDirection(event.clientX - start.x, event.clientY - start.y);
    if (direction) advance(direction);
  }

  if (!active) return null;
  if (events.length === 1) return <EventCard {...active} onOpenEvent={onOpenEvent} onShowOnMap={onShowOnMap} />;

  const slots = venueDeckSlots(ids, index, selection.direction);
  const dragDirection = dragX < 0 ? 1 : -1;
  const dragDestination = venueDeckSlots(ids, moveVenueDeckIndex(index, dragDirection, events.length), dragDirection);
  const dragProgress = Math.min(.9, Math.abs(dragX) / 120);
  const venueLabel = venue?.trim() || "To samo miejsce";

  return (
    <section className="eventVenueDeck" role="region" aria-roledescription="talia wydarzeń" aria-labelledby={`${id}-venue`}>
      <header className="eventVenueDeckHeader"><MapPin size={16} aria-hidden="true" /><div><h3 id={`${id}-venue`}>{venueLabel}</h3><p>Wydarzenia w tym miejscu na liście: {events.length}</p></div></header>
      <p className="srOnly" id={`${id}-instructions`}>Przesuń kartę lub wybierz odsłoniętą kartę z lewej albo prawej strony. Po ustawieniu fokusu na talii możesz też użyć strzałek klawiatury.</p>
      <div
        ref={stage}
        id={`${id}-cards`}
        className={`eventVenueDeckStage${dragX ? " eventVenueDeckDragging" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="Karty wydarzeń w tym miejscu"
        aria-describedby={`${id}-instructions`}
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={event => finishGesture(event)}
        onPointerCancel={event => finishGesture(event, true)}
        onLostPointerCapture={event => finishGesture(event, true)}
        onPointerLeave={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) finishGesture(event, true); }}
        onDragStart={event => { if (gesture.current) event.preventDefault(); }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            advance(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
        onClickCapture={event => {
          if (event.detail === 0 || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
          if (Date.now() < suppressClickUntil.current) {
            suppressClickUntil.current = 0;
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {events.map((item, layerIndex) => {
          const { event } = item;
          const slot = slots[layerIndex];
          const visual = dragX ? interpolateVenueDeckSlot(slot, dragDestination[layerIndex], dragProgress) : slot;
          const isFront = layerIndex === index;
          const painted = visual.visible;
          const style = {
            "--deck-offset-x": visual.x,
            "--deck-scale": visual.scale,
            "--deck-opacity": visual.opacity,
            zIndex: isFront ? 100 : 50 - Math.abs(slot.position),
            visibility: painted ? "visible" : "hidden"
          } as CSSProperties;

          return (
            <div key={event.id} data-deck-event={event.id} data-deck-slot={slot.position}
              className={`eventVenueDeckLayer${isFront ? " eventVenueDeckFront" : " eventVenueDeckRear"}${slot.position < 0 ? " eventVenueDeckLeft" : " eventVenueDeckRight"}`}
              style={style} aria-hidden={!isFront ? true : undefined} inert={!isFront}>
              {isFront ? <EventCard {...item} onOpenEvent={onOpenEvent} onShowOnMap={onShowOnMap} /> : painted ? (
                <article className="eventCardH eventVenueDeckPreview" aria-hidden="true" inert>
                  <div className="eventCardHLink">
                    <EventCardContent event={event} distanceKm={item.distanceKm} decorative />
                  </div>
                </article>
              ) : null}
            </div>
          );
        })}
        {slots.filter(slot => Math.abs(slot.position) === 1).map(slot => (
          <button key={slot.id} type="button" className={`eventVenueDeckSelect ${slot.position < 0 ? "eventVenueDeckLeft" : "eventVenueDeckRight"}`}
            aria-label={`Wybierz kartę: ${events[slot.index].event.title}`} aria-controls={`${id}-cards`}
            onClick={() => selectCard(slot.id, slot.position)} />
        ))}
      </div>
      <span className="eventVenueDeckCounter srOnly" aria-live="polite" aria-atomic="true">{active.event.title}. Wydarzenie {index + 1} z {events.length} na tej liście.</span>
    </section>
  );
}
