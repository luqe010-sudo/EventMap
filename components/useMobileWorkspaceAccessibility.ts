"use client";

import { useEffect, useRef, type RefObject } from "react";

type WorkspaceView = "list" | "map" | "event";

type Options = {
  workspaceRef: RefObject<HTMLElement | null>;
  view: WorkspaceView;
  event: { id: string; title: string } | null;
  onCloseEvent: () => void;
  onShowList: () => void;
};

type OriginalAttributes = { inert: boolean; ariaHidden: string | null };

// The workspace owns its URL/history. This hook owns accessibility of its direct
// list children, #mobile-map-view and #mobile-event-view; the view switcher and
// live announcements remain available. Navbar and Footer are outside this scope.
export function useMobileWorkspaceAccessibility({ workspaceRef, view, event, onCloseEvent, onShowList }: Options) {
  const originalAttributes = useRef(new Map<HTMLElement, OriginalAttributes>());
  const returnFocus = useRef<{ list: HTMLElement | null; map: HTMLElement | null }>({ list: null, map: null });
  const previousState = useRef<{ view: WorkspaceView; eventId: string | null } | null>(null);
  const workspaceTitle = useRef<string | null>(null);
  const eventTitle = useRef<string | null>(null);
  const handlers = useRef({ onCloseEvent, onShowList });

  useEffect(() => {
    handlers.current = { onCloseEvent, onShowList };
  }, [onCloseEvent, onShowList]);

  const eventId = event?.id ?? null;
  const title = event?.title ?? null;

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const mobile = window.matchMedia("(max-width: 760px)");

    function updateWorkspace() {
      if (!workspace) return;
      const visibleView: WorkspaceView = mobile.matches ? view : "list";
      const visibleEventId = visibleView === "event" ? eventId : null;
      const previous = previousState.current;
      const changedView = previous != null && previous.view !== visibleView;
      const changedEvent = visibleView === "event" && previous?.eventId !== visibleEventId;
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (changedView && activeElement && workspace.contains(activeElement) && !activeElement.closest(".mobileViewSwitcher")) {
        if (previous.view === "list" && !activeElement.closest("#mobile-map-view, #mobile-event-view")) {
          returnFocus.current.list = activeElement;
        } else if (previous.view === "map" && activeElement.closest("#mobile-map-view")) {
          returnFocus.current.map = activeElement;
        }
      }

      const children = Array.from(workspace.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
      const panels = children.filter((child) => !child.matches(".mobileViewSwitcher, .srOnly"));
      const isHidden = (child: HTMLElement) => child.id === "mobile-map-view"
        ? !mobile.matches || visibleView !== "map"
        : child.id === "mobile-event-view"
          ? !mobile.matches || visibleView !== "event"
          : visibleView !== "list";

      function setHidden(child: HTMLElement, hidden: boolean) {
        if (!originalAttributes.current.has(child)) {
          originalAttributes.current.set(child, { inert: child.inert, ariaHidden: child.getAttribute("aria-hidden") });
        }
        child.inert = hidden;
        const originalAriaHidden = originalAttributes.current.get(child)?.ariaHidden ?? null;
        if (hidden) child.setAttribute("aria-hidden", "true");
        else if (child.id === "mobile-map-view" || child.id === "mobile-event-view") child.setAttribute("aria-hidden", "false");
        else if (originalAriaHidden == null) child.removeAttribute("aria-hidden");
        else child.setAttribute("aria-hidden", originalAriaHidden);
      }

      // Enable the destination and move focus before hiding the outgoing view.
      for (const child of panels) {
        if (!isHidden(child)) setHidden(child, false);
      }

      if (changedView || changedEvent) {
        const savedFocus = visibleView === "list" ? returnFocus.current.list : visibleView === "map" ? returnFocus.current.map : null;
        const savedFocusVisible = savedFocus?.isConnected && !savedFocus.matches(":disabled") && !savedFocus.closest('[inert], [aria-hidden="true"]');
        const fallback = visibleView === "event"
          ? workspace.querySelector<HTMLElement>("#event-detail-title") ?? workspace.querySelector<HTMLElement>("#mobile-event-view")
          : workspace.querySelector<HTMLElement>(visibleView === "map" ? "#mobile-map-view" : "#events-list");
        const focusTarget = savedFocusVisible ? savedFocus : fallback;
        if (focusTarget) {
          if (!focusTarget.hasAttribute("tabindex") && !focusTarget.matches("a[href], button, input, select, textarea")) {
            focusTarget.tabIndex = -1;
          }
          focusTarget.focus({ preventScroll: true });
        }
      }

      for (const child of panels) {
        if (isHidden(child)) setHidden(child, true);
      }

      if (workspaceTitle.current == null) workspaceTitle.current = document.title;
      if (visibleView === "event" && title) {
        if (eventTitle.current == null) workspaceTitle.current = document.title;
        eventTitle.current = `${title} | MapaImprez`;
        document.title = eventTitle.current;
      } else if (eventTitle.current != null) {
        if (document.title === eventTitle.current) document.title = workspaceTitle.current;
        eventTitle.current = null;
      }
      previousState.current = { view: visibleView, eventId: visibleEventId };
    }

    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key !== "Escape" || keyEvent.defaultPrevented || !mobile.matches) return;
      if (view !== "map" && view !== "event") return;
      keyEvent.preventDefault();
      if (view === "event") handlers.current.onCloseEvent();
      else handlers.current.onShowList();
    }

    updateWorkspace();
    mobile.addEventListener("change", updateWorkspace);
    workspace.addEventListener("keydown", handleKeyDown);
    return () => {
      mobile.removeEventListener("change", updateWorkspace);
      workspace.removeEventListener("keydown", handleKeyDown);
    };
  }, [eventId, title, view, workspaceRef]);

  useEffect(() => {
    const attributes = originalAttributes.current;
    return () => {
      for (const [element, original] of attributes) {
        element.inert = original.inert;
        if (original.ariaHidden == null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", original.ariaHidden);
      }
      attributes.clear();
      if (eventTitle.current != null && document.title === eventTitle.current && workspaceTitle.current != null) {
        document.title = workspaceTitle.current;
      }
      eventTitle.current = null;
    };
  }, []);
}
