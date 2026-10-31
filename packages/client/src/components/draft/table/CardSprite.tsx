import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import CardType from '@utils/datatypes/Card';
import classNames from 'classnames';
import {
  animate,
  AnimationPlaybackControls,
  Easing,
  motion,
  MotionValue,
  useMotionValue,
  usePresence,
  useTransform,
} from 'framer-motion';

import FoilCardImage from '../../FoilCardImage';
import { Pose } from './tableLayout';

// How long a passed pack takes to gather into a pile and slide off the table.
// The next pack waits this long before it slides in.
export const PASS_OUT_SECONDS = 0.6;

// Sprites are keyed by card index where those are unique (the draft), and by
// card index plus occurrence where they aren't (basic lands in a deck).
export type SpriteId = number | string;

// The motion values behind a sprite, handed to the table so a drag can write
// the card's position directly (no React render per pointer move). For a card
// in a scrolling region, y is in that region's content coordinates: the card
// is drawn at y minus the region's scroll offset.
export interface SpriteHandle {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
}

// A vertical band of the stage, in drawn (on-screen) stage coordinates.
export interface Band {
  top: number;
  bottom: number;
}

// Read at exit time, so cards that leave the table know where to go.
export interface ExitPlan {
  // -1 leaves off the left edge, 1 off the right.
  direction: -1 | 1;
  stageWidth: number;
  // Where a passed pack gathers into a pile before it slides away.
  gatherX: number;
  gatherY: number;
  trashed: Set<SpriteId>;
  // On phones the pool isn't on the table: a pick shrinks into the pool's tab, centered here.
  picked: Set<SpriteId>;
  pickedX: number;
  pickedY: number;
}

export interface EnterFrom extends Pose {
  opacity: number;
  delay: number;
  // Popping out of an opened pack: appears instantly and lands with a bounce.
  burst?: boolean;
  // Travel to this pose first (with the rest of the pack), wait `hold` seconds, then fan out.
  via?: Pose;
  hold?: number;
}

interface CardSpriteProps {
  id: SpriteId;
  card: CardType;
  width: number;
  height: number;
  pose: Pose;
  z: number;
  // Which part of the table the card belongs to (e.g. pack, pool, deck). Moving
  // between zones is a trip across the table rather than a reshuffle in place.
  zone: string;
  // The zone's scroll offset, or null where it doesn't scroll.
  scroll: MotionValue<number> | null;
  // The table's sideways scroll, if it has one; x is in content coordinates like y.
  scrollX?: MotionValue<number> | null;
  // Where a resting card is cut off when scrolled out of its zone's view, if anywhere.
  clip: Band | null;
  // A card travelling in from another zone stays on top until it's inside this band.
  landing: Band | null;
  // Where the card appears from when it first mounts; null to appear in place.
  enterFrom: EnterFrom | null;
  // Leaves with the rest of a passed pack (gather, then slide off) rather than fading.
  passOnExit?: boolean;
  dragged: boolean;
  // Waiting inside a sealed pack: stay at the entrance pose until released.
  held?: boolean;
  // 'pan-y' lets a vertical swipe on the card scroll the page natively (phone deckbuilder).
  touchAction?: 'none' | 'pan-y';
  highlight: 'selected' | 'top' | null;
  children?: React.ReactNode;
  exitPlan?: React.MutableRefObject<ExitPlan>;
  register: (id: SpriteId, handle: SpriteHandle | null) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, id: SpriteId) => void;
  onHoverChange: (id: SpriteId, hovering: boolean) => void;
}

const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;
const BURST_SPRING = { type: 'spring', stiffness: 300, damping: 19 } as const;
const PASS_EASE: Easing[] = ['easeOut', 'easeIn'];

// A small stable number per sprite, for per-card variety like a pile's tilt.
export const spriteSeed = (id: SpriteId): number => {
  if (typeof id === 'number') return id;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 9973;
  return hash;
};

const insideBand = (center: number, band: Band) => center >= band.top && center <= band.bottom;

/**
 * One card on the table. It springs toward whatever pose the table gives it, so
 * reflowing a fan, opening a gap in a stack, moving between zones, and easing
 * back from an illegal drop are all the same motion. While dragged, the table
 * writes x/y straight into its motion values and the card follows the pointer
 * exactly.
 */
const CardSprite: React.FC<CardSpriteProps> = ({
  id,
  card,
  width,
  height,
  pose,
  z,
  zone,
  scroll,
  scrollX = null,
  clip,
  landing,
  enterFrom,
  passOnExit = false,
  dragged,
  held = false,
  touchAction = 'none',
  highlight,
  children,
  exitPlan,
  register,
  onPointerDown,
  onHoverChange,
}) => {
  const x = useMotionValue(enterFrom?.x ?? pose.x);
  const y = useMotionValue(enterFrom?.y ?? pose.y);
  const rotate = useMotionValue(enterFrom?.rotate ?? pose.rotate);
  const opacity = useMotionValue(enterFrom?.opacity ?? 1);
  const scale = useMotionValue(1);
  // Cards in a scrolling zone are drawn shifted up by its scroll.
  const offset = useMotionValue(0);
  const drawnY = useTransform([y, offset], ([value, shift]: number[]) => value - shift);
  const noScrollX = useMotionValue(0);
  const drawnX = useTransform([x, scrollX ?? noScrollX], ([value, shift]: number[]) => value - shift);
  const clipPath = useMotionValue('none');
  const [isPresent, safeToRemove] = usePresence();

  // Still travelling after a drop or a move between zones; it isn't clipped to
  // its zone's view until it lands.
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const entering = useRef(enterFrom);
  const enterStartsAt = useRef<number | null>(null);
  const wasDragged = useRef(false);
  const prevZone = useRef(zone);
  const linkedScroll = useRef<MotionValue<number> | null | undefined>(undefined);
  const run = useRef(0);

  useEffect(() => {
    register(id, { x, y, rotate });
    return () => register(id, null);
  }, [id, register, x, y, rotate]);

  // Follow the zone's scroll. Switching zones converts y between the old and
  // new zone's content coordinates so the card doesn't jump.
  useLayoutEffect(() => {
    const was = linkedScroll.current;
    linkedScroll.current = scroll;
    if (was !== undefined && was !== scroll) y.jump(y.get() - (was?.get() ?? 0) + (scroll?.get() ?? 0));
    if (!scroll) {
      offset.set(0);
      return undefined;
    }
    offset.set(scroll.get());
    return scroll.on('change', (value) => offset.set(value));
  }, [scroll, y, offset]);

  // Released cards take their real stacking order straight away, so a card
  // dropped into the back of a stack eases in behind the cards in front of it.
  // The exception is a card travelling in from another zone (e.g. a pick flying
  // down from the pack): it stays on top until it's inside its new zone, then
  // slots into the stacking order there.
  const [elevated, setElevated] = useState(false);
  const [elevatedZone, setElevatedZone] = useState(zone);
  if (zone !== elevatedZone) {
    setElevatedZone(zone);
    setElevated(landing !== null && !insideBand(drawnY.get() + height / 2, landing));
  }
  const landingTop = landing?.top ?? 0;
  const landingBottom = landing?.bottom ?? 0;
  useEffect(() => {
    if (!elevated) return undefined;
    const check = (top: number) => {
      if (insideBand(top + height / 2, { top: landingTop, bottom: landingBottom })) setElevated(false);
    };
    check(drawnY.get());
    return drawnY.on('change', check);
  }, [elevated, landingTop, landingBottom, height, drawnY]);

  // A resting card scrolled out of its zone's view is cut off at the edge.
  const clipping = clip !== null && !dragged && !settling;
  const clipTop = clip?.top ?? 0;
  const clipBottom = clip?.bottom ?? 0;
  useEffect(() => {
    if (!clipping) {
      clipPath.set('none');
      return undefined;
    }
    const update = (top: number) => {
      const cutTop = clipTop - top;
      const cutBottom = top + height - clipBottom;
      clipPath.set(
        cutTop > 0 || cutBottom > 0
          ? `inset(${cutTop > 0 ? cutTop : -40}px -40px ${cutBottom > 0 ? cutBottom : -60}px -40px)`
          : 'none',
      );
    };
    update(drawnY.get());
    return drawnY.on('change', update);
  }, [clipping, clipTop, clipBottom, height, drawnY, clipPath]);

  useEffect(() => {
    if (!isPresent) return undefined;
    if (dragged) {
      wasDragged.current = true;
      // Grabbing a card mid-entrance ends the entrance; once dropped it just goes home.
      entering.current = null;
      x.stop();
      y.stop();
      return undefined;
    }
    if (held) return undefined;

    if (wasDragged.current || prevZone.current !== zone) {
      settlingRef.current = true;
      setSettling(true);
    }
    wasDragged.current = false;
    prevZone.current = zone;

    // The entrance shapes every move until it has played, so a layout change
    // while the card is still waiting (e.g. the stage settling its size) keeps
    // the card on its schedule instead of skipping ahead.
    const enter = entering.current;
    let delay = 0;
    if (enter) {
      const now = performance.now();
      if (enterStartsAt.current === null) enterStartsAt.current = now + enter.delay * 1000;
      delay = Math.max(0, (enterStartsAt.current - now) / 1000);
    }

    const token = ++run.current;
    let live = true;
    let controls: AnimationPlaybackControls[] = [];
    const moveToPose = (spring: typeof SPRING | typeof BURST_SPRING, startDelay: number, fade: number) => {
      controls = [
        animate(x, pose.x, { ...spring, delay: startDelay }),
        animate(y, pose.y, { ...spring, delay: startDelay }),
        animate(rotate, pose.rotate, { ...spring, delay: startDelay }),
        animate(opacity, 1, { duration: fade, delay: startDelay }),
      ];
      if (settlingRef.current) {
        Promise.all(controls.map((control) => control.finished)).then(() => {
          if (run.current === token) {
            settlingRef.current = false;
            setSettling(false);
            setElevated(false);
          }
        });
      }
    };

    if (enter?.via) {
      // Arrive with the rest of the pack, pause, then fan out.
      const via = enter.via;
      const travel = { duration: 0.32, ease: 'easeOut' as const, delay };
      controls = [
        animate(x, via.x, travel),
        animate(y, via.y, travel),
        animate(rotate, via.rotate, travel),
        animate(opacity, 1, { duration: 0.05, delay }),
      ];
      Promise.all(controls.map((control) => control.finished)).then(() => {
        if (!live) return;
        entering.current = null;
        moveToPose(SPRING, enter.hold ?? 0, 0.05);
      });
    } else {
      if (enter && delay === 0) entering.current = null;
      moveToPose(enter?.burst ? BURST_SPRING : SPRING, delay, enter?.burst ? 0.05 : 0.2);
    }

    return () => {
      live = false;
      controls.forEach((control) => control.stop());
    };
  }, [pose.x, pose.y, pose.rotate, dragged, held, zone, isPresent, x, y, rotate, opacity]);

  // Leaving the table: a passed pack gathers into a pile in the middle, then
  // slides off toward the next drafter; a trashed card drops away; a pick on a
  // phone shrinks into the pool's tab; anything else fades.
  useEffect(() => {
    if (isPresent) return;
    const plan = exitPlan?.current;
    let controls: AnimationPlaybackControls[];
    if (plan?.picked.has(id)) {
      // Scaled about its bottom edge, so aim the shrunken card's center at the tab.
      const shrink = 0.2;
      const timing = { duration: 0.45, ease: 'easeIn' as const };
      controls = [
        animate(x, plan.pickedX - width / 2, timing),
        animate(y, plan.pickedY - height + (height * shrink) / 2, timing),
        animate(rotate, 0, timing),
        animate(scale, shrink, timing),
        animate(opacity, 0, { duration: 0.15, delay: 0.3 }),
      ];
    } else if (plan?.trashed.has(id)) {
      controls = [
        animate(y, y.get() + height * 0.8, { duration: 0.4, ease: 'easeIn' }),
        animate(rotate, rotate.get() + 16, { duration: 0.4, ease: 'easeIn' }),
        animate(opacity, 0, { duration: 0.4, ease: 'easeIn' }),
      ];
    } else if (plan && passOnExit) {
      const offTable = plan.direction < 0 ? -width * 1.5 : plan.stageWidth + width * 0.5;
      const pile = (spriteSeed(id) % 9) - 4;
      const timing = { duration: PASS_OUT_SECONDS, times: [0, 0.45, 1], ease: PASS_EASE };
      controls = [
        animate(x, [x.get(), plan.gatherX, offTable], timing),
        animate(y, [y.get(), plan.gatherY, plan.gatherY], timing),
        animate(rotate, [rotate.get(), pile, pile + plan.direction * 14], timing),
      ];
    } else {
      controls = [animate(opacity, 0, { duration: 0.25 })];
    }
    Promise.all(controls.map((control) => control.finished)).then(() => safeToRemove?.());
    // Exit runs once, when presence flips; later prop changes don't apply to a leaving card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  return (
    <motion.div
      className="absolute left-0 top-0 select-none"
      style={{
        x: drawnX,
        y: drawnY,
        rotate,
        scale,
        opacity,
        clipPath,
        width,
        height,
        zIndex: dragged ? 3000 : elevated ? 2500 : z,
        transformOrigin: '50% 100%',
        touchAction,
        // A long press picks the card up; don't let the browser show its own menu.
        WebkitTouchCallout: 'none',
        pointerEvents: isPresent ? 'auto' : 'none',
        cursor: dragged ? 'grabbing' : 'grab',
      }}
      onPointerDown={(event) => onPointerDown(event, id)}
      onContextMenu={(event) => event.preventDefault()}
      onPointerEnter={() => onHoverChange(id, true)}
      onPointerLeave={() => onHoverChange(id, false)}
    >
      <div
        className={classNames(
          'relative w-full h-full card-border overflow-hidden pointer-events-none transition-shadow',
          {
            'shadow-[0_28px_44px_-14px_rgba(0,0,0,0.85)]': dragged,
            'shadow-[0_10px_22px_-10px_rgba(0,0,0,0.85)]': !dragged,
            'ring-2 ring-white': highlight === 'selected',
            'ring-[3px] ring-[#3b82f6]': highlight === 'top',
          },
        )}
      >
        <FoilCardImage card={card} height="100%" />
      </div>
      {/* Badges and labels belong to the card's spot; they don't leave with it. */}
      {isPresent && children}
    </motion.div>
  );
};

export default CardSprite;
