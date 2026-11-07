import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { animate, MotionValue } from 'framer-motion';

import { SpriteHandle, SpriteId } from './CardSprite';

export interface ScrollRegion {
  left: number;
  right: number;
  top: number;
  // Where the region's content starts (below any labels); defaults to top.
  viewTop?: number;
  bottom: number;
  scroll: MotionValue<number>;
  max: number;
}

// A sideways scroll shared by everything on the stage.
export interface HorizontalScroll {
  scroll: MotionValue<number>;
  max: number;
}

export interface DragSession {
  // The card being held, or null when panning the table from an empty spot.
  id: SpriteId | null;
  // The zone the card was picked up from, and its scroll: the card's y stays in
  // that zone's content coordinates until it's dropped.
  zone: string;
  scroll: MotionValue<number> | null;
  // The zone's own sideways scroll, when it has one apart from the table's; x is
  // in its content coordinates. Left out, the card goes with the table's.
  scrollX?: MotionValue<number> | null;
  pointerId: number;
  // press: mouse down, becomes a drag once it moves. hold: touch down, becomes a
  // drag if held in place or a pan if it moves first. pan: scrolling the table.
  // peek: a touch held in place on a card shown bigger, until it lifts.
  mode: 'press' | 'hold' | 'pan' | 'drag' | 'peek';
  startX: number;
  startY: number;
  // Pointer offset from the card's top-left, so the card doesn't jump to the cursor.
  grabX: number;
  grabY: number;
  stageLeft: number;
  stageTop: number;
  lastX: number;
  lastY: number;
  // Latest pointer position, for scrolling a region while the card is held at its edge.
  pointerX: number;
  pointerY: number;
  // Panning: the regions being scrolled vertically and sideways, the one axis the
  // swipe keeps to (the way it started), and recent positions for momentum.
  panRegion: ScrollRegion | null;
  panX: HorizontalScroll | null;
  panAxis: 'x' | 'y';
  panSamples: { t: number; x: number; y: number }[];
}

export interface ActiveDrag<T> {
  id: SpriteId;
  zone: string;
  target: T | null;
}

export interface CardDragOptions<T> {
  stageRef: React.RefObject<HTMLDivElement | null>;
  // Where a card is picked up from, read when the pointer goes down; null if it can't be picked up.
  locate: (
    id: SpriteId,
  ) => { zone: string; scroll: MotionValue<number> | null; scrollX?: MotionValue<number> | null } | null;
  // What a card drawn at this position (stage coordinates of its top-left) would drop onto.
  target: (session: DragSession, left: number, top: number) => T | null;
  sameTarget: (a: T | null, b: T | null) => boolean;
  drop: (session: DragSession, target: T | null) => void;
  // A press without a drag; pointerType tells a tap ('touch') from a mouse click.
  click: (id: SpriteId, pointerType: string) => void;
  dragStarted?: () => void;
  // Regions that scroll vertically: by swiping, and when a card is held near their top or bottom edge.
  scrollRegions?: () => ScrollRegion[];
  // The table's sideways scroll, if it has one.
  horizontal?: () => HorizontalScroll | null;
  // A part of the table that scrolls sideways on its own, at a point on the stage:
  // swiping there scrolls it, and so does holding a card at its left or right edge.
  horizontalAt?: (x: number, y: number) => HorizontalScroll | null;
  // The table is taller than its view and something around it does the vertical
  // scrolling: the page (window), or a scrolling panel the table sits in. Holding
  // a card near the top or bottom of that view scrolls it.
  verticalScroller?: () => HTMLElement | Window | null;
  // A touch on a card picks it up as soon as it moves, as a mouse does, rather
  // than after being held in place (when a swipe scrolls the table instead).
  touchPicksUp?: boolean;
  // With touchPicksUp, a touch held in place on a card shows it bigger until the
  // finger lifts (returns whether it did); lifting then isn't a tap.
  peek?: (id: SpriteId) => boolean;
  endPeek?: () => void;
  // The held card leans into the direction it moves; off when the player turned animations off.
  lean?: boolean;
}

// Just short of critically damped, so a held card leans and settles without bouncing.
const TILT_SPRING = { type: 'spring', stiffness: 380, damping: 38 } as const;
const DRAG_THRESHOLD = 6;
// On touch, holding a card this long picks it up; moving sooner scrolls instead.
const HOLD_DELAY = 220;
// Where a touch picks a card up as soon as it moves, holding it in place this long shows it bigger.
const PEEK_DELAY = 400;
// Holding a card within this many px of a scrolling region's edge scrolls it,
// faster the closer to the edge, up to this many px per millisecond...
const EDGE_ZONE = 60;
const EDGE_SPEED = 1.1;
// ...after it's been held there this long, so passing through an edge on the way somewhere doesn't scroll.
const EDGE_DWELL = 120;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const scrollTopOf = (scroller: HTMLElement | Window) =>
  scroller instanceof Window ? scroller.scrollY : scroller.scrollTop;

// The part of the screen a scroller shows, top to bottom. The page's ends above
// any bar fixed over its bottom (see CubeBottomNav).
const scrollerView = (scroller: HTMLElement | Window) => {
  if (!(scroller instanceof Window)) return scroller.getBoundingClientRect();
  const covered = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height')) || 0;
  return { top: 0, bottom: scroller.innerHeight - covered };
};

/**
 * Pointer-driven dragging for card sprites: the real card follows the pointer
 * (leaning into the direction of travel), the table is told what it's over so
 * other cards can make room, and a press without movement is a click. On
 * touch, a card is picked up by holding it; a swipe scrolls the table.
 */
export const useCardDrag = <T>(options: CardDragOptions<T>) => {
  // Window listeners outlive a render, so they read the latest options through this.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const handles = useRef(new Map<SpriteId, SpriteHandle>());
  const register = useCallback((id: SpriteId, handle: SpriteHandle | null) => {
    if (handle) handles.current.set(id, handle);
    else handles.current.delete(id);
  }, []);

  const session = useRef<DragSession | null>(null);
  const tiltTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeFrame = useRef<number | null>(null);
  // Which edges the card is being held at, and since when.
  const edgeHoldY = useRef<{ scroll: MotionValue<number>; direction: number; since: number } | null>(null);
  const edgeHoldX = useRef<{ direction: number; since: number } | null>(null);
  const edgeHoldPage = useRef<{ direction: number; since: number } | null>(null);
  const [drag, setDrag] = useState<ActiveDrag<T> | null>(null);

  const api = useMemo(() => {
    // How far a card's zone is scrolled sideways: its own scroll, or the table's.
    const offsetX = (s: Pick<DragSession, 'scrollX'> | null) =>
      s?.scrollX !== undefined ? (s.scrollX?.get() ?? 0) : (latest.current.horizontal?.()?.scroll.get() ?? 0);
    const drawnLeft = (s: Pick<DragSession, 'scrollX'> | null, handle: SpriteHandle) => handle.x.get() - offsetX(s);
    const drawnTop = (s: DragSession, handle: SpriteHandle) => handle.y.get() - (s.scroll?.get() ?? 0);
    const heldCard = (s: DragSession | null) =>
      s?.mode === 'drag' && s.id !== null ? handles.current.get(s.id) : undefined;

    const retarget = (s: DragSession, handle: SpriteHandle) => {
      if (s.id === null) return;
      const { target, sameTarget } = latest.current;
      const next = target(s, drawnLeft(s, handle), drawnTop(s, handle));
      const id = s.id;
      setDrag((prev) => {
        if (!prev) return { id, zone: s.zone, target: next };
        return sameTarget(prev.target, next) ? prev : { ...prev, target: next };
      });
    };

    // A zone scrolled under an active drag: a card picked up from that zone
    // scrolls with its content, so hold it under the pointer, then re-aim.
    const scrolled = (scroll: MotionValue<number>, delta: number) => {
      const s = session.current;
      const handle = heldCard(s);
      if (!s || !handle) return;
      if (s.scroll === scroll) handle.y.set(handle.y.get() + delta);
      retarget(s, handle);
    };

    // Something scrolled sideways under an active drag: a card picked up from
    // what scrolled moves with it, so hold it under the pointer, then re-aim.
    const scrolledAlong = (scroll: MotionValue<number>, delta: number) => {
      const s = session.current;
      const handle = heldCard(s);
      if (!s || !handle) return;
      const own = s.scrollX !== undefined ? s.scrollX : (latest.current.horizontal?.()?.scroll ?? null);
      if (own === scroll) handle.x.set(handle.x.get() + delta);
      retarget(s, handle);
    };
    // The table scrolled sideways.
    const scrolledX = (delta: number) => {
      const table = latest.current.horizontal?.();
      if (table) scrolledAlong(table.scroll, delta);
    };

    // The scrolling region at a point on the stage. A point past the stage's
    // edges counts as being at that edge, so dragging out of the table keeps scrolling.
    const regionAt = (px: number, py: number) => {
      const stage = latest.current.stageRef.current;
      if (!stage) return undefined;
      const x = clamp(px, 0, stage.clientWidth - 1);
      const y = clamp(py, 0, stage.clientHeight - 1);
      return (latest.current.scrollRegions?.() ?? []).find(
        (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
      );
    };

    // The page can scroll mid-drag, moving the stage on screen; re-read where it is.
    const refreshStage = (s: DragSession) => {
      const rect = latest.current.stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      s.stageLeft = rect.left;
      s.stageTop = rect.top;
    };

    // Put the held card under the pointer (stage and scroll positions may have changed).
    const follow = (s: DragSession, handle: SpriteHandle) => {
      handle.x.set(s.pointerX - s.stageLeft - s.grabX + offsetX(s));
      handle.y.set(s.pointerY - s.stageTop - s.grabY + (s.scroll?.get() ?? 0));
    };

    // While a card is held near an edge of a scrolling region (or of the table,
    // sideways), keep scrolling it every frame until the card moves away.
    const edgeScroll = (time: number, last: number) => {
      const s = session.current;
      const stage = latest.current.stageRef.current;
      if (s?.mode !== 'drag' || !stage) {
        edgeFrame.current = null;
        return;
      }
      const dt = Math.min(50, time - last);
      refreshStage(s);
      const px = s.pointerX - s.stageLeft;
      const py = s.pointerY - s.stageTop;

      const region = regionAt(px, py);
      let speedY = 0;
      if (region && region.max > 0) {
        const topEdge = region.viewTop ?? region.top;
        if (py < topEdge + EDGE_ZONE) speedY = -Math.min(1, (topEdge + EDGE_ZONE - py) / EDGE_ZONE);
        else if (py > region.bottom - EDGE_ZONE) speedY = Math.min(1, (py - (region.bottom - EDGE_ZONE)) / EDGE_ZONE);
      }
      const holdY = edgeHoldY.current;
      if (!region || speedY === 0) edgeHoldY.current = null;
      else if (!holdY || holdY.scroll !== region.scroll || holdY.direction !== Math.sign(speedY)) {
        edgeHoldY.current = { scroll: region.scroll, direction: Math.sign(speedY), since: time };
      } else if (time - holdY.since >= EDGE_DWELL) {
        const before = region.scroll.get();
        const next = clamp(before + speedY * EDGE_SPEED * dt, 0, region.max);
        if (next !== before) {
          region.scroll.stop();
          region.scroll.set(next);
          scrolled(region.scroll, next - before);
        }
      }

      const horizontal = latest.current.horizontalAt?.(px, py) ?? latest.current.horizontal?.();
      let speedX = 0;
      if (horizontal && horizontal.max > 0) {
        const width = stage.clientWidth;
        if (px < EDGE_ZONE) speedX = -Math.min(1, (EDGE_ZONE - px) / EDGE_ZONE);
        else if (px > width - EDGE_ZONE) speedX = Math.min(1, (px - (width - EDGE_ZONE)) / EDGE_ZONE);
      }
      const holdX = edgeHoldX.current;
      if (!horizontal || speedX === 0) edgeHoldX.current = null;
      else if (!holdX || holdX.direction !== Math.sign(speedX)) {
        edgeHoldX.current = { direction: Math.sign(speedX), since: time };
      } else if (time - holdX.since >= EDGE_DWELL) {
        const before = horizontal.scroll.get();
        const next = clamp(before + speedX * EDGE_SPEED * dt, 0, horizontal.max);
        if (next !== before) {
          horizontal.scroll.stop();
          horizontal.scroll.set(next);
          scrolledAlong(horizontal.scroll, next - before);
        }
      }

      const scroller = latest.current.verticalScroller?.();
      if (scroller) {
        const view = scrollerView(scroller);
        let speedPage = 0;
        if (s.pointerY < view.top + EDGE_ZONE)
          speedPage = -Math.min(1, (view.top + EDGE_ZONE - s.pointerY) / EDGE_ZONE);
        else if (s.pointerY > view.bottom - EDGE_ZONE) {
          speedPage = Math.min(1, (s.pointerY - (view.bottom - EDGE_ZONE)) / EDGE_ZONE);
        }
        const holdPage = edgeHoldPage.current;
        if (speedPage === 0) edgeHoldPage.current = null;
        else if (!holdPage || holdPage.direction !== Math.sign(speedPage)) {
          edgeHoldPage.current = { direction: Math.sign(speedPage), since: time };
        } else if (time - holdPage.since >= EDGE_DWELL) {
          const before = scrollTopOf(scroller);
          scroller.scrollBy(0, speedPage * EDGE_SPEED * dt);
          const handle = heldCard(s);
          if (scrollTopOf(scroller) !== before && handle) {
            refreshStage(s);
            follow(s, handle);
            retarget(s, handle);
          }
        }
      }

      edgeFrame.current = requestAnimationFrame((now) => edgeScroll(now, time));
    };

    // Once a card is held, a touch moving it mustn't scroll the page natively
    // (that would cancel the drag); while swiping or waiting, it may.
    const touchMove = (event: TouchEvent) => {
      if (session.current?.mode === 'drag' && event.cancelable) event.preventDefault();
    };

    const beginDrag = (s: DragSession) => {
      const handle = s.id !== null ? handles.current.get(s.id) : undefined;
      if (!handle) return;
      s.mode = 'drag';
      latest.current.dragStarted?.();
      retarget(s, handle);
      const now = performance.now();
      edgeFrame.current = requestAnimationFrame((time) => edgeScroll(time, now));
    };

    // A swipe across scrolls what's under the finger sideways, and nothing else; a
    // swipe down scrolls the region under the finger, and once that can't go
    // further, the verticalScroller if there is one. Never the page otherwise: on
    // iOS, scrolling the page under a touch shifts the touch's next coordinates by
    // the scroll until the screen catches up, so each step reads as a bigger swipe
    // and the page runs away.
    const panBy = (s: DragSession, dx: number, dy: number) => {
      const horizontal = s.panX;
      if (s.panAxis === 'x') {
        if (horizontal && horizontal.max > 0)
          horizontal.scroll.set(clamp(horizontal.scroll.get() - dx, 0, horizontal.max));
        return;
      }
      let leftover = -dy;
      const region = s.panRegion;
      if (region && region.max > 0) {
        const wanted = region.scroll.get() - dy;
        const next = clamp(wanted, 0, region.max);
        region.scroll.set(next);
        leftover = wanted - next;
      }
      if (leftover !== 0) latest.current.verticalScroller?.()?.scrollBy(0, leftover);
    };

    // Let a swipe carry on a little after the finger lifts.
    const coast = (s: DragSession) => {
      const samples = s.panSamples.filter((sample) => sample.t > performance.now() - 100);
      if (samples.length < 2) return;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = Math.max(1, last.t - first.t);
      const vx = ((last.x - first.x) / elapsed) * 1000;
      const vy = ((last.y - first.y) / elapsed) * 1000;
      const inertia = {
        type: 'inertia',
        power: 0.6,
        timeConstant: 300,
        bounceStiffness: 400,
        bounceDamping: 40,
      } as const;
      const horizontal = s.panX;
      if (s.panAxis === 'x' && horizontal && horizontal.max > 0 && Math.abs(vx) > 50) {
        animate(horizontal.scroll, horizontal.scroll.get(), { ...inertia, velocity: -vx, min: 0, max: horizontal.max });
      }
      const region = s.panRegion;
      if (s.panAxis === 'y' && region && region.max > 0 && Math.abs(vy) > 50) {
        animate(region.scroll, region.scroll.get(), { ...inertia, velocity: -vy, min: 0, max: region.max });
      }
    };

    const end = () => {
      if (session.current?.mode === 'peek') latest.current.endPeek?.();
      if (edgeFrame.current !== null) cancelAnimationFrame(edgeFrame.current);
      edgeFrame.current = null;
      edgeHoldY.current = null;
      edgeHoldX.current = null;
      edgeHoldPage.current = null;
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (tiltTimer.current) clearTimeout(tiltTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      session.current = null;
    };

    function move(event: PointerEvent) {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      s.pointerX = event.clientX;
      s.pointerY = event.clientY;

      // A card shown bigger stays put until the finger lifts.
      if (s.mode === 'peek') return;
      if (s.mode === 'press' || s.mode === 'hold') {
        if (Math.hypot(event.clientX - s.startX, event.clientY - s.startY) < DRAG_THRESHOLD) return;
        if (s.mode === 'press') {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          beginDrag(s);
        } else {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          s.mode = 'pan';
          s.panRegion = regionAt(s.startX - s.stageLeft, s.startY - s.stageTop) ?? null;
          s.panX =
            latest.current.horizontalAt?.(s.startX - s.stageLeft, s.startY - s.stageTop) ??
            latest.current.horizontal?.() ??
            null;
          s.panAxis = Math.abs(event.clientX - s.startX) > Math.abs(event.clientY - s.startY) ? 'x' : 'y';
        }
      }

      const dx = event.clientX - s.lastX;
      const dy = event.clientY - s.lastY;
      s.lastX = event.clientX;
      s.lastY = event.clientY;

      if (s.mode === 'pan') {
        panBy(s, dx, dy);
        s.panSamples.push({ t: performance.now(), x: event.clientX, y: event.clientY });
        if (s.panSamples.length > 8) s.panSamples.shift();
        return;
      }

      const handle = heldCard(s);
      if (!handle) return;
      refreshStage(s);
      follow(s, handle);

      // Lean into the direction of travel, then settle upright when the pointer rests.
      if (latest.current.lean !== false) {
        animate(handle.rotate, clamp(dx * 0.7, -8, 8), TILT_SPRING);
        if (tiltTimer.current) clearTimeout(tiltTimer.current);
        tiltTimer.current = setTimeout(() => animate(handle.rotate, 0, TILT_SPRING), 70);
      }

      retarget(s, handle);
    }

    function up(event: PointerEvent) {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      end();
      if (s.mode === 'pan') {
        coast(s);
        return;
      }
      if (s.mode === 'peek') return;
      if (s.mode !== 'drag') {
        if (s.id !== null) latest.current.click(s.id, event.pointerType);
        return;
      }
      const handle = heldCard(s);
      if (handle) latest.current.drop(s, latest.current.target(s, drawnLeft(s, handle), drawnTop(s, handle)));
      setDrag(null);
    }

    function cancel(event: PointerEvent) {
      const s = session.current;
      if (!s || event.pointerId !== s.pointerId) return;
      end();
      setDrag(null);
    }

    // A touch stops any coasting, like it would in a native scroller.
    const stopCoasting = (event: React.PointerEvent<HTMLDivElement>) => {
      latest.current.horizontal?.()?.scroll.stop();
      (latest.current.scrollRegions?.() ?? []).forEach((region) => region.scroll.stop());
      const rect = latest.current.stageRef.current?.getBoundingClientRect();
      if (rect) latest.current.horizontalAt?.(event.clientX - rect.left, event.clientY - rect.top)?.scroll.stop();
    };

    const startSession = (event: React.PointerEvent<HTMLDivElement>, fields: Partial<DragSession>) => {
      const stage = latest.current.stageRef.current;
      if (!stage) return null;
      const rect = stage.getBoundingClientRect();
      const s: DragSession = {
        id: null,
        zone: '',
        scroll: null,
        pointerId: event.pointerId,
        mode: event.pointerType === 'touch' ? 'hold' : 'press',
        startX: event.clientX,
        startY: event.clientY,
        grabX: 0,
        grabY: 0,
        stageLeft: rect.left,
        stageTop: rect.top,
        lastX: event.clientX,
        lastY: event.clientY,
        pointerX: event.clientX,
        pointerY: event.clientY,
        panRegion: null,
        panX: null,
        panAxis: 'y',
        panSamples: [],
        ...fields,
      };
      session.current = s;
      window.addEventListener('touchmove', touchMove, { passive: false });
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      return s;
    };

    const pointerDown = (event: React.PointerEvent<HTMLDivElement>, id: SpriteId) => {
      if (event.button !== 0 || session.current) return;
      const stage = latest.current.stageRef.current;
      const handle = handles.current.get(id);
      const from = latest.current.locate(id);
      if (!stage || !handle || !from) return;
      event.preventDefault();
      event.stopPropagation();
      stopCoasting(event);
      const rect = stage.getBoundingClientRect();
      const s = startSession(event, {
        id,
        ...(latest.current.touchPicksUp ? { mode: 'press' as const } : {}),
        zone: from.zone,
        scroll: from.scroll,
        ...(from.scrollX !== undefined ? { scrollX: from.scrollX } : {}),
        grabX: event.clientX - rect.left - drawnLeft(from, handle),
        grabY: event.clientY - rect.top - (handle.y.get() - (from.scroll?.get() ?? 0)),
      });
      if (s?.mode === 'hold') {
        holdTimer.current = setTimeout(() => {
          if (session.current !== s || s.mode !== 'hold') return;
          navigator.vibrate?.(10);
          beginDrag(s);
        }, HOLD_DELAY);
      } else if (s && event.pointerType === 'touch' && latest.current.peek) {
        holdTimer.current = setTimeout(() => {
          if (session.current !== s || s.mode !== 'press' || !latest.current.peek?.(id)) return;
          navigator.vibrate?.(10);
          s.mode = 'peek';
        }, PEEK_DELAY);
      }
    };

    // Touching an empty part of the table scrolls it.
    const backgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'touch' || session.current || event.target !== event.currentTarget) return;
      stopCoasting(event);
      startSession(event, {});
    };

    const isDragging = () => session.current?.mode === 'drag';

    // Something else takes over the pointer (a pinch): drop whatever was held where it came from.
    const cancelSession = () => {
      if (!session.current) return;
      end();
      setDrag(null);
    };

    return { pointerDown, backgroundPointerDown, scrolled, scrolledX, isDragging, cancelSession, end };
  }, []);

  useEffect(() => api.end, [api]);

  return {
    drag,
    register,
    pointerDown: api.pointerDown,
    backgroundPointerDown: api.backgroundPointerDown,
    scrolled: api.scrolled,
    scrolledX: api.scrolledX,
    isDragging: api.isDragging,
    cancel: api.cancelSession,
  };
};

/**
 * Wheel scrolling for regions of the stage that hold more than fits, plus the
 * table's sideways scroll (trackpad swipes, or shift + wheel). Only captures
 * the wheel when something can actually scroll, so the page still scrolls
 * everywhere else.
 */
export const useWheelScroll = (
  stageRef: React.RefObject<HTMLDivElement | null>,
  regions: ScrollRegion[],
  scrolled: (scroll: MotionValue<number>, delta: number) => void,
  horizontal?: HorizontalScroll | null,
  scrolledX?: (delta: number) => void,
) => {
  const latest = useRef({ regions, scrolled, horizontal, scrolledX });
  useLayoutEffect(() => {
    latest.current = { regions, scrolled, horizontal, scrolledX };
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    // Non-passive so it can stop the page scrolling, which React's onWheel can't do.
    const listener = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : 1;
      const sideways = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (sideways) {
        const across = latest.current.horizontal;
        if (!across || across.max <= 0) return;
        event.preventDefault();
        const step = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
        const before = across.scroll.get();
        const next = clamp(before + step, 0, across.max);
        if (next === before) return;
        across.scroll.stop();
        across.scroll.set(next);
        latest.current.scrolledX?.(next - before);
        return;
      }

      const rect = stage.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const region = latest.current.regions.find((r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom);
      if (!region || region.max <= 0) return;
      event.preventDefault();
      const before = region.scroll.get();
      const next = clamp(before + event.deltaY * unit, 0, region.max);
      if (next === before) return;
      region.scroll.stop();
      region.scroll.set(next);
      latest.current.scrolled(region.scroll, next - before);
    };
    stage.addEventListener('wheel', listener, { passive: false });
    return () => stage.removeEventListener('wheel', listener);
  }, [stageRef]);
};

/** Keep a scroll offset within range when the content shrinks. */
export const useClampScroll = (scroll: MotionValue<number>, max: number) => {
  useEffect(() => {
    if (scroll.get() > max) animate(scroll, max, { duration: 0.25, ease: 'easeOut' });
  }, [scroll, max]);
};
