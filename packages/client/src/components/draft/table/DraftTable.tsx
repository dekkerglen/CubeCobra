import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeftIcon, CpuIcon, StackIcon, ZapIcon } from '@primer/octicons-react';
import { cardName, makeSubtitle } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import { getCardDefaultRowColumn } from '@utils/draftutil';
import { AnimatePresence, motion, MotionValue, useMotionValue } from 'framer-motion';

import AutocardContext from '../../../contexts/AutocardContext';
import DisplayContext from '../../../contexts/DisplayContext';
import TagColorContext from '../../../contexts/TagColorContext';
import DraftLocation from '../../../drafting/DraftLocation';
import Button from '../../base/Button';
import Link from '../../base/Link';
import Spinner from '../../base/Spinner';
import Text from '../../base/Text';
import FoilCardImage from '../../FoilCardImage';
import BoosterPack from './BoosterPack';
import CardSprite, { EnterFrom, ExitPlan, PASS_OUT_SECONDS, SpriteId } from './CardSprite';
import { isCompactWidth } from './deckLayout';
import { PhoneMenuButton, PhoneMenuPanel } from './PhoneMenu';
import PoolTray, { PoolTab } from './PoolTray';
import ScrollThumb from './ScrollThumb';
import {
  COLUMN_LABELS,
  columnAt,
  computeGeometry,
  computeRowsGeometry,
  gatherPose,
  MAIN_COLUMNS,
  maxPoolScroll,
  nearestPackSlot,
  packSlots,
  Pose,
  SIDEBOARD_COLUMN,
  stackInsertIndex,
  stackSlot,
  TableGeometry,
} from './tableLayout';
import { DragSession, revealInView, ScrollRegion, useCardDrag, useClampScroll, useWheelScroll } from './useCardDrag';

interface DraftTableProps {
  // All draft cards; every other prop refers to cards by their index in here.
  cards: CardType[];
  pack: number[];
  packNumber: number;
  pickNumber: number;
  // Dressing for the sealed pack shown when a pack is opened.
  cubeName: string;
  packArt?: string;
  packLabel?: string;
  // Whether the pack on the table is unopened (nobody has drafted from it yet), when the
  // page knows; otherwise the table guesses from cards leaving and arriving.
  freshPack?: boolean;
  // The largest pack in the draft; the desktop table is sized for it.
  packSize?: number;
  mainboard: number[][][];
  sideboard: number[][][];
  title: string;
  ratings?: number[];
  // Owned by the page, so the choice lasts the whole draft.
  showRatings: boolean;
  onToggleRatings: () => void;
  loading: boolean;
  disabled: boolean;
  // The draft is finishing; nothing on the table can move.
  locked: boolean;
  pendingPick: number | null;
  isTrashStep: boolean;
  error: boolean;
  onRetry: () => void;
  retryInProgress: boolean;
  headerActions?: React.ReactNode;
  // The same actions as links, for the menu on phones.
  menuActions?: React.ReactNode;
  onPick: (packIndex: number) => void;
  onTrash: (packIndex: number) => void;
  onPickTo: (packIndex: number, target: DraftLocation) => void;
  onMovePoolCard: (source: DraftLocation, target: DraftLocation) => void;
  // A second header line, e.g. waiting on the bots.
  subtitle?: string;
  // The pack is face down (Archdemon of Paliano): any card drafts a random one.
  blind?: boolean;
  onPickBlind?: () => void;
  // The player can only pass this pack.
  passOnly?: boolean;
  onPass?: () => void;
  // Pool cards whose ability is ready (they rock), and abilities switched on for the next pick.
  readyCards?: number[];
  armedCards?: number[];
  // What draft-matters cards noted, by card index.
  notes?: Record<number, string[]>;
  // Cards the player removed from the draft.
  removed?: number[];
  // Shown over the pack, e.g. where a Lore Seeker pack came from.
  packTag?: string;
  // Packs waiting for the player, the one on screen included.
  queueCount?: number;
  onPoolCardPress?: (card: number) => void;
  // Pool cards that can be dropped onto the pack (Cogwork Librarian), and the drop.
  poolToPack?: number[];
  // Pool cards drawn in the pack until the pick goes through (an armed Cogwork Librarian).
  // Clicking one, or dragging it back to the pool, is onPoolCardPress.
  inPack?: number[];
  onPoolCardToPack?: (card: number) => void;
  // Prompts, toasts and the like, drawn over the table.
  effects?: React.ReactNode;
}

// One stored pile that feeds a pool column. A CMC column shows the creature row
// then the non-creature row; the sideboard column shows all its piles in order.
interface Segment {
  board: 'deck' | 'sideboard';
  row: number;
  col: number;
  ids: number[];
}

// 'tab': the pool's tab on phones, which drafts the card into its natural spot.
// 'packDrop': a pool card dropped onto the pack to use it (Cogwork Librarian).
type DropTarget =
  | { kind: 'pack'; index: number }
  | { kind: 'pool'; column: number; index: number }
  | { kind: 'tab' }
  | { kind: 'packDrop' }
  | null;

type Zone = 'pack' | 'pool';

interface Placement {
  pose: Pose;
  z: number;
  zone: Zone;
}

// passed: slides in from the neighbor; burst: pops out of a pack being opened;
// opened: deals out from the middle (a pack already in progress on load); pool: fades in place.
type EnterKind = 'passed' | 'burst' | 'opened' | 'pool';

interface Turnover {
  signature: string;
  pack: number[];
  seen: Set<number>;
  // Cards left but the next pack hasn't arrived yet.
  passPending: boolean;
  // How each newly seen card should enter the table.
  kinds: Map<number, EnterKind>;
  // Packs opened so far, used to key the opening animation.
  openings: number;
}

interface Opening {
  id: number;
  label?: string;
  cardCount: number;
  // The pack has burst and its cards are flying out.
  burst: boolean;
}

// Phones: the pool's tab on the right edge of the table, and how close to that
// edge a pack card has to be held to drop into it.
const TAB_WIDTH = 22;
const TAB_DROP_ZONE = 40;

const LINK_CLASS =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

const EMPTY_TURNOVER: Turnover = {
  signature: '',
  pack: [],
  seen: new Set(),
  passPending: false,
  kinds: new Map(),
  openings: 0,
};

const sameTarget = (a: DropTarget, b: DropTarget): boolean => {
  if (a === null || b === null) return a === b;
  if (a.kind === 'pack' && b.kind === 'pack') return a.index === b.index;
  if (a.kind === 'pool' && b.kind === 'pool') return a.column === b.column && a.index === b.index;
  return a.kind === b.kind;
};

const buildColumns = (mainboard: number[][][], sideboard: number[][][]): Segment[][] => {
  const columns: Segment[][] = [];
  for (let col = 0; col < MAIN_COLUMNS; col += 1) {
    columns.push([0, 1].map((row) => ({ board: 'deck' as const, row, col, ids: mainboard[row]?.[col] ?? [] })));
  }
  columns.push(
    Array.from({ length: MAIN_COLUMNS }, (_, col) => ({
      board: 'sideboard' as const,
      row: 0,
      col,
      ids: sideboard[0]?.[col] ?? [],
    })),
  );
  return columns;
};

/**
 * The draft table: a fixed-height table that fits the viewport. The pack is
 * fanned across the top and the pool is stacked in CMC columns below. Every card
 * is a sprite on one stage, so any card can be dragged anywhere and everything
 * else eases out of the way. Click a pack card to draft it; on touch, tap to
 * raise it and tap again to draft it.
 *
 * On phones the table holds only the pack, laid out in rows; the pool is a
 * tray that slides in from a tab on the right, listing the mainboard and sideboard.
 *
 * Draft rules stay in CubeDraftPage; the table only decides where cards are
 * drawn and translates drops into the page's existing pick/move handlers.
 */
const DraftTable: React.FC<DraftTableProps> = ({
  cards,
  pack,
  packNumber,
  pickNumber,
  cubeName,
  packArt,
  packLabel,
  freshPack,
  packSize,
  mainboard,
  sideboard,
  title,
  ratings,
  showRatings,
  onToggleRatings,
  loading,
  disabled,
  locked,
  pendingPick,
  isTrashStep,
  error,
  onRetry,
  retryInProgress,
  headerActions,
  menuActions,
  onPick,
  onTrash,
  onPickTo,
  onMovePoolCard,
  subtitle,
  blind = false,
  onPickBlind,
  passOnly = false,
  onPass,
  readyCards = [],
  armedCards = [],
  notes = {},
  removed = [],
  packTag,
  queueCount = 0,
  onPoolCardPress,
  poolToPack = [],
  inPack = [],
  onPoolCardToPack,
  effects,
}) => {
  const { showCard, hideCard } = useContext(AutocardContext);
  const { showCustomImages } = useContext(DisplayContext);
  const tagColors = useContext(TagColorContext);

  // The room the table has, before its own margins: what decides the phone layout.
  const roomRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [roomWidth, setRoomWidth] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const [customOrder, setCustomOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  const [poolTab, setPoolTab] = useState<PoolTab>('mainboard');

  // The handlers are defined further down; these wrappers only run on pointer events.
  const dragger = useCardDrag<DropTarget>({
    stageRef,
    locate: (id) => locate(Number(id)),
    target: (session, left, top) => computeTarget(session, left, top),
    sameTarget,
    drop: (session, target) => drop(session, target),
    click: (id, pointerType) => click(Number(id), pointerType),
    dragStarted: () => {
      hideCard();
      setHovered(null);
      setSelected(null);
    },
    scrollRegions: () => scrollRegions,
  });
  const { drag } = dragger;

  useLayoutEffect(() => {
    const el = stageRef.current;
    const room = roomRef.current;
    if (!el || !room) return undefined;
    const measure = () => {
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
      setRoomWidth(room.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(room);
    return () => observer.disconnect();
  }, []);

  // Decided by the room rather than the stage, since the phone layout drops the
  // table's margins and so widens the stage: deciding by the stage could flip back and forth.
  const compact = roomWidth > 0 && isCompactWidth(roomWidth);
  // Phones lay out the pack as it is, so a pack of 15 always looks the same. The
  // count keeps a pick that's in flight, so what's left of the pack holds its
  // layout until the next pack arrives. Desktop is sized for the largest pack,
  // so the pool holds still as the pack shrinks.
  const packCount = pack.length + inPack.length;
  const capacity = Math.max(packSize ?? 0, packCount);
  const geometry: TableGeometry | null = useMemo(() => {
    if (stageSize.width <= 0 || stageSize.height <= 0) return null;
    return compact
      ? computeRowsGeometry(stageSize.width, stageSize.height, packCount)
      : computeGeometry(stageSize.width, stageSize.height, capacity);
  }, [stageSize.width, stageSize.height, compact, packCount, capacity]);

  // Phones: once, ease the page down so the table exactly fills the screen.
  const broughtIntoView = useRef(false);
  useEffect(() => {
    if (!compact || broughtIntoView.current) return;
    broughtIntoView.current = true;
    const table = tableRef.current;
    if (table) window.scrollTo({ top: window.scrollY + table.getBoundingClientRect().top, behavior: 'smooth' });
  }, [compact]);

  // The stored piles. Cards drawn in the pack (inPack) are still in them, but not drawn there.
  const columns = useMemo(() => buildColumns(mainboard, sideboard), [mainboard, sideboard]);
  const inPackSet = useMemo(() => new Set(inPack), [inPack]);
  const shownInColumn = useCallback(
    (segments: Segment[]) => segments.flatMap((segment) => segment.ids).filter((id) => !inPackSet.has(id)),
    [inPackSet],
  );
  const poolIds = useMemo(
    () => new Set(columns.flat().flatMap((segment) => segment.ids.filter((id) => !inPackSet.has(id)))),
    [columns, inPackSet],
  );

  // A pick made while bots are still thinking is already in the pool but still
  // in the pack; the pool copy wins.
  const packIds = useMemo(
    () => [
      ...pack.filter((id, index) => index !== pendingPick && !poolIds.has(id) && cards[id]),
      ...inPack.filter((id) => cards[id]),
    ],
    [pack, pendingPick, poolIds, cards, inPack],
  );
  const packIdSet = useMemo(() => new Set(packIds), [packIds]);

  // Display order of the fan: the player's own arrangement, with new cards appended.
  const packOrder = useMemo(() => {
    const kept = customOrder.filter((id) => packIdSet.has(id));
    const keptSet = new Set(kept);
    return [...kept, ...packIds.filter((id) => !keptSet.has(id))];
  }, [customOrder, packIds, packIdSet]);

  const activeSelected = selected !== null && packIdSet.has(selected) ? selected : null;

  const ratingById = useMemo(() => {
    const map = new Map<number, number>();
    if (ratings && ratings.length === pack.length) pack.forEach((id, i) => map.set(id, ratings[i]));
    return map;
  }, [ratings, pack]);
  const maxRating = ratingById.size > 0 ? Math.max(...ratingById.values()) : 0;

  const canCommit = !disabled && !loading && !locked;
  // Drafting by dropping into the pool; trash steps and blind picks are click-only.
  const canPlaceFromPack = canCommit && !isTrashStep && !blind;
  const readySet = useMemo(() => new Set(readyCards), [readyCards]);
  const armedSet = useMemo(() => new Set(armedCards), [armedCards]);

  // ---- Where every card sits this render ----
  const placements = useMemo(() => {
    const result = new Map<number, Placement>();
    if (!geometry) return result;
    const draggedId = drag ? Number(drag.id) : null;
    const target = drag?.target ?? null;

    const fan = packOrder.filter((id) => id !== draggedId);
    const gapAt = target?.kind === 'pack' ? target.index : -1;
    const slots = packSlots(geometry, fan.length + (gapAt >= 0 ? 1 : 0));
    let slot = 0;
    fan.forEach((id) => {
      if (slot === gapAt) slot += 1;
      const base = slots[slot];
      let pose = base;
      let z = 100 + slot;
      if (id === activeSelected) {
        pose = { x: base.x, y: base.y - geometry.raise, rotate: 0 };
        z = 600;
      } else if (id === hovered && !drag) {
        pose = { x: base.x, y: base.y - geometry.peek, rotate: 0 };
        z = 500;
      }
      result.set(id, { pose, z, zone: 'pack' });
      slot += 1;
    });

    // Phones keep the pool in a drawer, off the stage.
    if (!compact) {
      columns.forEach((segments, column) => {
        const ids = shownInColumn(segments).filter((id) => id !== draggedId);
        const gap = target?.kind === 'pool' && target.column === column ? target.index : -1;
        let index = 0;
        ids.forEach((id) => {
          if (index === gap) index += 1;
          result.set(id, { pose: stackSlot(geometry, column, index), z: 10 + index, zone: 'pool' });
          index += 1;
        });
      });
    }

    // The dragged card keeps its home placement, so an illegal drop eases it back there.
    if (draggedId !== null) {
      const homeSlot = packOrder.indexOf(draggedId);
      if (homeSlot >= 0) {
        const pose = packSlots(geometry, packOrder.length)[homeSlot];
        result.set(draggedId, { pose, z: 100 + homeSlot, zone: 'pack' });
      } else {
        columns.forEach((segments, column) => {
          const ids = shownInColumn(segments);
          const index = ids.indexOf(draggedId);
          if (index >= 0) {
            const pose = stackSlot(geometry, column, index);
            result.set(draggedId, { pose, z: 10 + index, zone: 'pool' });
          }
        });
      }
    }
    return result;
  }, [geometry, compact, packOrder, columns, shownInColumn, drag, activeSelected, hovered]);

  // ---- Pack turnover: where new cards come from, where leaving cards go ----
  // Pack 1 is passed left, so its packs arrive from the right and leftovers
  // leave to the left; pack 2 is the reverse, and so on.
  const passesLeft = packNumber % 2 === 1;
  const exitPlan = useRef<ExitPlan>({
    direction: -1,
    stageWidth: 0,
    gatherX: 0,
    gatherY: 0,
    trashed: new Set(),
    picked: new Set(),
    pickedX: 0,
    pickedY: 0,
  });
  useLayoutEffect(() => {
    // Leaving cards read this from their (passive) exit effects, which run after layout effects.
    exitPlan.current.direction = passesLeft ? -1 : 1;
    exitPlan.current.stageWidth = stageSize.width;
    if (geometry) {
      const pile = gatherPose(geometry);
      exitPlan.current.gatherX = pile.x;
      exitPlan.current.gatherY = pile.y;
      // The pool's tab, centered on the right edge.
      exitPlan.current.pickedX = geometry.width - TAB_WIDTH / 2;
      exitPlan.current.pickedY = geometry.height / 2;
    }
  });

  // Track which cards are already on the table, and classify newcomers: a pack
  // that arrives right after the previous one left was passed to us; one that
  // arrives with nothing leaving (first load, or after the last pick of a pack)
  // was freshly opened. Adjusted during render so newcomers mount with it.
  const [turnover, setTurnover] = useState<Turnover>(EMPTY_TURNOVER);
  const [opening, setOpening] = useState<Opening | null>(null);
  const burstOpening = useCallback(() => setOpening((current) => current && { ...current, burst: true }), []);
  const endOpening = useCallback(() => setOpening(null), []);
  const drawnSignature = geometry ? [...packIds, ...poolIds].join(',') : '';
  if (geometry && drawnSignature !== turnover.signature) {
    const packLeft = turnover.pack.some((id) => !packIdSet.has(id) && !poolIds.has(id));
    const leftBefore = packLeft || turnover.passPending;
    const entered = packIds.some((id) => !turnover.seen.has(id));
    const firstDraw = turnover.signature === '';
    // A pack opened mid-draft, or the first pick on load, gets the full opening.
    // Reloading partway through a pack just deals the cards back out.
    const passed = freshPack === undefined ? leftBefore : entered && !freshPack && !firstDraw;
    const unwrapped =
      freshPack === undefined ? entered && !passed && (!firstDraw || pickNumber === 1) : entered && freshPack;
    const kinds = new Map<number, EnterKind>();
    packIds.forEach((id) => {
      if (!turnover.seen.has(id)) kinds.set(id, passed ? 'passed' : unwrapped ? 'burst' : 'opened');
    });
    poolIds.forEach((id) => {
      if (!turnover.seen.has(id)) kinds.set(id, 'pool');
    });
    const openings = turnover.openings + (unwrapped ? 1 : 0);
    if (unwrapped) setOpening({ id: openings, label: packLabel, cardCount: packIds.length, burst: false });
    setTurnover({
      signature: drawnSignature,
      pack: packIds,
      seen: new Set([...packIds, ...poolIds]),
      passPending: leftBefore && !entered,
      kinds,
      openings,
    });
  }

  const enterFor = (id: number, placement: Placement): EnterFrom | null => {
    const kind = turnover.kinds.get(id);
    if (!geometry || !kind) return null;
    if (kind === 'pool') return { ...placement.pose, opacity: 0, delay: 0 };
    const slot = packOrder.indexOf(id);
    // A slight per-card tilt so a gathered pack reads as a pile.
    const pileTilt = ((id * 37) % 9) - 4;
    if (kind === 'burst') {
      // Held hidden inside the sealed pack until it bursts, then every card eases to its spot at once.
      return {
        x: geometry.packCenterX - geometry.cardW / 2,
        y: geometry.packCenterY - geometry.cardH / 2,
        rotate: pileTilt,
        opacity: 0,
        delay: 0,
        burst: true,
      };
    }
    if (kind === 'passed') {
      // Once the outgoing pack has left, slide in as a pile to the middle, then fan out.
      const fromRight = passesLeft;
      const pile = gatherPose(geometry);
      return {
        x: fromRight ? geometry.width + geometry.cardW * 0.3 : -geometry.cardW * 1.3,
        y: pile.y,
        rotate: pileTilt + (fromRight ? 8 : -8),
        opacity: 1,
        delay: PASS_OUT_SECONDS,
        via: { x: pile.x + (slot - (packOrder.length - 1) / 2) * 1.5, y: pile.y, rotate: pileTilt },
        hold: 0.08,
      };
    }
    // A pack already in progress on load deals out from the middle, all at once.
    return {
      x: geometry.packCenterX - geometry.cardW / 2,
      y: geometry.packBottom,
      rotate: 0,
      opacity: 0,
      delay: 0.05,
    };
  };

  // ---- Pool scrolling ----
  // Stacks never squeeze; when the tallest one runs past the bottom, the pool scrolls.
  const poolScroll = useMotionValue(0);
  const tallestStack = Math.max(
    0,
    ...columns.map(
      (segments, column) =>
        shownInColumn(segments).length + (drag?.target?.kind === 'pool' && drag.target.column === column ? 1 : 0),
    ),
  );
  const maxScroll = geometry && !compact ? maxPoolScroll(geometry, tallestStack) : 0;
  useClampScroll(poolScroll, maxScroll);
  const scrollRegions: ScrollRegion[] =
    geometry && !compact
      ? [
          {
            left: 0,
            right: geometry.width,
            top: geometry.poolTop,
            viewTop: geometry.stackTop,
            bottom: geometry.height,
            scroll: poolScroll,
            max: maxScroll,
          },
        ]
      : [];
  useWheelScroll(stageRef, scrollRegions, dragger.scrolled);

  // After a pick, scroll the pool so the card's landing spot is in view.
  const revealId = useRef<number | null>(null);
  useLayoutEffect(() => {
    const id = revealId.current;
    if (id === null || !geometry) return;
    const placement = placements.get(id);
    if (!placement) {
      revealId.current = null;
      return;
    }
    // Still in the pack until the page moves it.
    if (placement.zone !== 'pool') return;
    revealId.current = null;
    const stack = shownInColumn(columns.find((segments) => shownInColumn(segments).includes(id)) ?? []);
    // The last card in a stack shows its whole face, the others just their name bar.
    const top = placement.pose.y;
    const bottom = top + (stack[stack.length - 1] === id ? geometry.cardH : geometry.bar);
    revealInView(poolScroll, top, bottom, geometry.stackTop, geometry.poolBottom, maxScroll);
  });

  // ---- Drag and click ----
  // Typed, since the drag hook that calls it is declared before the placements it reads.
  const locate = (id: number): { zone: Zone; scroll: MotionValue<number> | null } | null =>
    placements.has(id)
      ? { zone: packIdSet.has(id) ? 'pack' : 'pool', scroll: packIdSet.has(id) ? null : poolScroll }
      : null;

  const computeTarget = (s: DragSession, left: number, top: number): DropTarget => {
    if (!geometry) return null;
    const centerX = left + geometry.cardW / 2;
    // Pack or pool by where the card is held, like the pool's edge scrolling.
    const pointerY = top + s.grabY;

    const backToPool = inPackSet.has(Number(s.id)) && !locked;
    if (compact) {
      if (s.zone !== 'pack') return null;
      if (left + s.grabX >= geometry.width - TAB_DROP_ZONE)
        return canPlaceFromPack || backToPool ? { kind: 'tab' } : null;
      return {
        kind: 'pack',
        index: nearestPackSlot(geometry, packOrder.length, centerX, top + geometry.cardH / 2),
      };
    }

    if (pointerY < geometry.packBottom) {
      // Pool cards can't go back into the pack, except to use one (Cogwork Librarian).
      if (s.zone !== 'pack') return poolToPack.includes(Number(s.id)) && !locked ? { kind: 'packDrop' } : null;
      return { kind: 'pack', index: nearestPackSlot(geometry, packOrder.length, centerX, top + geometry.cardH / 2) };
    }

    if (s.zone === 'pack' && !canPlaceFromPack && !backToPool) return null;
    if (locked) return null;
    const column = columnAt(geometry, centerX);
    if (column === null) return null;
    const count = shownInColumn(columns[column]).filter((id) => id !== s.id).length;
    return { kind: 'pool', column, index: stackInsertIndex(geometry, top + poolScroll.get(), count) };
  };

  // Turn a visual position in a column into a stored location. Indices are
  // computed with the dragged card already removed, which is how the page's
  // move handler applies them. At a boundary between piles (e.g. the last
  // creature / first non-creature) the card's natural pile wins.
  const resolveLocation = (id: number, column: number, index: number): DraftLocation => {
    // As drawn: without the dragged card or cards drawn in the pack.
    const segments = columns[column].map((segment) => ({
      ...segment,
      stored: segment.ids.filter((other) => other !== id),
      ids: segment.ids.filter((other) => other !== id && !inPackSet.has(other)),
    }));
    const card = cards[id];
    const natural = card ? getCardDefaultRowColumn(card) : { row: 1, col: 0 };
    const preferred = column === SIDEBOARD_COLUMN ? natural.col : natural.row;

    let start = 0;
    let segment = segments[segments.length - 1];
    let at = segment.ids.length;
    let found = false;
    for (let i = 0; i < segments.length; i += 1) {
      const within = index - start;
      if (within >= 0 && within <= segments[i].ids.length && (!found || i === preferred)) {
        segment = segments[i];
        at = within;
        found = true;
      }
      start += segments[i].ids.length;
    }
    // Back to a position in the stored pile, which may hold cards that aren't drawn.
    const stored = at < segment.ids.length ? segment.stored.indexOf(segment.ids[at]!) : segment.stored.length;
    return segment.board === 'deck'
      ? DraftLocation.deck(segment.row, segment.col, stored)
      : DraftLocation.sideboard(segment.row, segment.col, stored);
  };

  const findPoolLocation = (id: number): DraftLocation | null => {
    for (const segment of columns.flat()) {
      const index = segment.ids.indexOf(id);
      if (index >= 0) {
        return segment.board === 'deck'
          ? DraftLocation.deck(segment.row, segment.col, index)
          : DraftLocation.sideboard(segment.row, segment.col, index);
      }
    }
    return null;
  };

  const drop = (s: DragSession, target: DropTarget) => {
    if (target === null) return;
    const id = Number(s.id);

    if (target.kind === 'packDrop') {
      onPoolCardToPack?.(id);
      return;
    }

    // A card drawn in the pack, put back in the pool.
    if (inPackSet.has(id) && (target.kind === 'pool' || target.kind === 'tab')) {
      onPoolCardPress?.(id);
      return;
    }

    if (target.kind === 'pack') {
      const order = packOrder.filter((other) => other !== id);
      order.splice(target.index, 0, id);
      setCustomOrder(order);
      return;
    }

    if (target.kind === 'tab') {
      const packIndex = pack.indexOf(id);
      if (packIndex >= 0) {
        exitPlan.current.picked.add(id);
        onPick(packIndex);
      }
      return;
    }

    const location = resolveLocation(id, target.column, target.index);
    if (s.zone === 'pack') {
      const packIndex = pack.indexOf(id);
      if (packIndex >= 0) {
        revealId.current = id;
        onPickTo(packIndex, location);
      }
      return;
    }

    const source = findPoolLocation(id);
    if (!source) return;
    const unchanged =
      source.type === location.type &&
      source.row === location.row &&
      source.col === location.col &&
      source.index === location.index;
    if (!unchanged) onMovePoolCard(source, location);
  };

  // With a mouse, the hover preview already shows the card, so a click drafts it.
  // A tap raises the card first so it can be read, and a second tap drafts it.
  const click = (id: number, pointerType: string) => {
    if (locked) return;
    if (inPackSet.has(id)) {
      onPoolCardPress?.(id);
      return;
    }
    if (!packIdSet.has(id)) {
      if (!poolIds.has(id)) return;
      // A card with an ability opens its prompt; any other goes to the other board.
      if (readySet.has(id) || armedSet.has(id)) onPoolCardPress?.(id);
      else {
        const source = findPoolLocation(id);
        if (source) togglePoolCard(source);
      }
      return;
    }
    // Face down there's nothing to read first: any card is a random pick.
    if (blind) {
      if (canCommit) onPickBlind?.();
      return;
    }
    if (pointerType === 'touch' && activeSelected !== id) {
      setSelected(id);
      return;
    }
    if (!canCommit) return;
    const packIndex = pack.indexOf(id);
    if (packIndex < 0) return;
    setSelected(null);
    hideCard();
    if (isTrashStep) {
      exitPlan.current.trashed.add(id);
      onTrash(packIndex);
    } else {
      revealId.current = id;
      if (compact) exitPlan.current.picked.add(id);
      onPick(packIndex);
    }
  };

  // ---- The pool tray (phones) ----
  // A tap sends a card to the other board, in its natural spot.
  const togglePoolCard = (source: DraftLocation) => {
    if (locked) return;
    const board = source.type === 'deck' ? mainboard : sideboard;
    const card = cards[board[source.row]?.[source.col]?.[source.index] ?? -1];
    if (!card) return;
    const { row, col } = getCardDefaultRowColumn(card);
    onMovePoolCard(
      source,
      source.type === 'deck'
        ? DraftLocation.sideboard(0, col, sideboard[0]?.[col]?.length ?? 0)
        : DraftLocation.deck(row, col, mainboard[row]?.[col]?.length ?? 0),
    );
  };

  const onHoverChange = (spriteId: SpriteId, hovering: boolean) => {
    if (dragger.isDragging()) return;
    const id = Number(spriteId);
    if (hovering) {
      setHovered(id);
      const card = cards[id];
      if (card && !(blind && packIdSet.has(id))) showCard(card, showCustomImages, tagColors);
    } else {
      setHovered((current) => (current === id ? null : current));
      hideCard();
    }
  };

  // ---- Render ----
  const mainboardCards = useMemo(
    () =>
      columns
        .slice(0, MAIN_COLUMNS)
        .flatMap((segments) => segments.flatMap((segment) => segment.ids.map((id) => cards[id]))),
    [columns, cards],
  );
  const columnCounts = columns.map((segments) => shownInColumn(segments).length);
  const hoveredColumn = drag?.target?.kind === 'pool' ? drag.target.column : null;
  const hasRatings = ratingById.size > 0;

  const sprites: React.ReactNode[] = [];
  placements.forEach((placement, id) => {
    const card = cards[id];
    if (!card) return;
    const inPackZone = placement.zone === 'pack';
    const rating = blind ? undefined : ratingById.get(id);
    const isSelected = id === activeSelected;
    const isTop = showRatings && rating !== undefined && rating === maxRating && maxRating > 0;
    const isArmed = armedSet.has(id);
    const cardNotes = inPackZone ? [] : (notes[id] ?? []);
    sprites.push(
      <CardSprite
        key={`card-${id}`}
        id={id}
        card={card}
        width={geometry!.cardW}
        height={geometry!.cardH}
        pose={placement.pose}
        z={placement.z}
        zone={placement.zone}
        scroll={placement.zone === 'pool' ? poolScroll : null}
        clip={placement.zone === 'pool' ? { top: geometry!.stackTop, bottom: Infinity } : null}
        landing={placement.zone === 'pool' ? { top: geometry!.poolTop, bottom: Infinity } : null}
        passOnExit={placement.zone === 'pack'}
        enterFrom={enterFor(id, placement)}
        dragged={drag?.id === id}
        held={opening !== null && !opening.burst && turnover.kinds.get(id) === 'burst'}
        highlight={isSelected ? 'selected' : isArmed ? 'armed' : isTop ? 'top' : null}
        rocking={!inPackZone && readySet.has(id) && !isArmed && hovered !== id}
        faceDown={inPackZone && blind && !inPackSet.has(id)}
        exitPlan={exitPlan}
        register={dragger.register}
        onPointerDown={dragger.pointerDown}
        onHoverChange={onHoverChange}
      >
        {placement.zone === 'pack' && showRatings && rating !== undefined && (
          <div
            className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xxs font-bold text-white shadow-lg ${
              isTop ? 'bg-[#3b82f6]' : 'bg-black/80'
            }`}
          >
            {Math.round(rating * 100)}%
          </div>
        )}
        {cardNotes.length > 0 && (
          // On the name bar, so it shows on a stacked card too.
          <div
            className="pointer-events-none absolute top-0.5 right-0.5 px-1.5 rounded-full bg-black/80 text-white text-xxs leading-4 truncate"
            style={{ maxWidth: '50%' }}
          >
            {cardNotes.join(' · ')}
          </div>
        )}
        {isSelected && geometry!.rows && (
          // No room below a card in rows, so the label sits on the card.
          <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span
              className={`px-2 py-0.5 rounded-full text-xxs font-bold text-white shadow-lg ${
                isTrashStep ? 'bg-button-danger' : 'bg-button-primary'
              }`}
            >
              {canCommit ? `Tap to ${isTrashStep ? 'trash' : 'draft'}` : 'Waiting...'}
            </span>
          </div>
        )}
        {isSelected && !geometry!.rows && (
          <div className="pointer-events-none absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap flex flex-col items-center gap-0.5">
            <span
              className={`px-3 py-0.5 rounded-full text-xxs font-bold text-white shadow-lg ${
                isTrashStep ? 'bg-button-danger' : 'bg-button-primary'
              }`}
            >
              {canCommit ? `Tap to ${isTrashStep ? 'trash' : 'draft'}` : 'Waiting...'}
            </span>
            <span className="text-xxs text-text-secondary max-w-40 truncate">{cardName(card)}</span>
          </div>
        )}
      </CardSprite>,
    );
  });

  const retryButton = (
    <Button onClick={onRetry} color="danger" disabled={retryInProgress}>
      {retryInProgress ? 'Retrying...' : 'Bot picks failed. Try again?'}
    </Button>
  );
  const ratingsLink = hasRatings && !error && (
    <Link
      onClick={() => {
        onToggleRatings();
        setMenuOpen(false);
      }}
      className={LINK_CLASS}
    >
      <CpuIcon size={16} />
      {showRatings ? 'Hide Bot Ratings' : 'Show CubeCobra Bot Ratings'}
    </Link>
  );
  const hasMenu = Boolean(menuActions) || Boolean(ratingsLink);
  const tabTarget = drag?.target?.kind === 'tab';
  const packDropTarget = drag?.target?.kind === 'packDrop';
  const passButton = passOnly && onPass && (
    <Button color="primary" onClick={onPass} disabled={locked}>
      Pass
    </Button>
  );
  const queueBadge = queueCount > 1 && (
    <span className="flex items-center gap-1 text-xs text-text-secondary" title={`${queueCount} packs`}>
      <StackIcon size={14} />
      {queueCount}
    </span>
  );
  // Phones: ready and armed cards sit in the corner of the table, since the pool is in a tray.
  const cornerCards = compact
    ? [...armedCards, ...readyCards.filter((id) => !armedSet.has(id))].filter((id) => !inPackSet.has(id))
    : [];

  return (
    // Exactly one viewport tall (less the phone's bottom nav) regardless of the
    // header above it: scroll past the header and the table fills the screen.
    // In the phone layout it runs edge to edge, over the page's side padding.
    <div ref={roomRef}>
      <div
        ref={tableRef}
        className={`relative mt-3 flex flex-col bg-bg-accent/80 shadow overflow-hidden ${
          compact ? '-mx-2 border-y border-border' : 'mx-2 rounded-md border border-border'
        }`}
        style={{ height: 'calc(100dvh - var(--bottom-nav-height, 0px))', minHeight: 480 }}
      >
        {compact ? (
          // The menu drops over the table rather than pushing it down, so the cards keep their size.
          <div className="relative z-10 border-b border-border">
            {/* A fixed height, so the cards don't resize when the waiting line comes and goes. */}
            <div className="flex items-center gap-2 h-11 px-2">
              <div className="flex flex-col min-w-0">
                <Text semibold className="truncate leading-5">
                  {title}
                </Text>
                {subtitle && (
                  <Text xs className="text-text-secondary truncate">
                    {subtitle}
                  </Text>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {queueBadge}
                {passButton}
                {hasMenu && (
                  <PhoneMenuButton
                    open={menuOpen}
                    onToggle={() => setMenuOpen((open) => !open)}
                    label="Draft options"
                  />
                )}
              </div>
            </div>
            {error && <div className="px-2 pb-2">{retryButton}</div>}
            {hasMenu && (
              <div className="absolute inset-x-0 top-full bg-bg-accent shadow-lg">
                <PhoneMenuPanel open={menuOpen}>
                  <div className="flex flex-col items-end gap-3 py-2 px-2 border-b border-border">
                    {menuActions}
                    {ratingsLink}
                  </div>
                </PhoneMenuPanel>
              </div>
            )}
          </div>
        ) : (
          // A fixed height, so the cards don't resize as the buttons and the waiting line come and go.
          <div className="flex items-center gap-4 h-12 px-4 border-b border-border">
            <div className="flex flex-col shrink-0">
              <Text semibold lg className="whitespace-nowrap leading-6">
                {title}
              </Text>
              {subtitle && (
                <Text xs className="text-text-secondary">
                  {subtitle}
                </Text>
              )}
            </div>
            {queueBadge}
            <Text xs className="flex-1 min-w-0 truncate text-right text-text-secondary">
              {makeSubtitle(mainboardCards.filter(Boolean))}
            </Text>
            <div className="flex shrink-0 gap-2 items-center">
              {passButton}
              {headerActions}
              {error
                ? retryButton
                : hasRatings && (
                    <Button onClick={onToggleRatings} color="primary">
                      {showRatings ? 'Hide Bot Ratings' : 'Show CubeCobra Bot Ratings'}
                    </Button>
                  )}
            </div>
          </div>
        )}

        {/* isolate: the cards' z-indexes stay inside the stage, under the menu and the pool drawer. */}
        <div
          ref={stageRef}
          className="relative flex-1 overflow-hidden select-none isolate"
          style={{ touchAction: 'none' }}
          onPointerDown={(event) => {
            setMenuOpen(false);
            if (event.target === event.currentTarget) setSelected(null);
            dragger.backgroundPointerDown(event);
          }}
        >
          {geometry && !compact && (
            <>
              <div
                className="absolute rounded-lg bg-bg/60 border border-border pointer-events-none"
                style={{
                  left: geometry.columnX[0] - 8,
                  width: geometry.columnX[MAIN_COLUMNS - 1] + geometry.cardW - geometry.columnX[0] + 16,
                  top: geometry.poolTop - 4,
                  bottom: 4,
                }}
              />
              <div
                className="absolute rounded-lg bg-bg/60 border border-border pointer-events-none"
                style={{
                  left: geometry.columnX[SIDEBOARD_COLUMN] - 8,
                  width: geometry.cardW + 16,
                  top: geometry.poolTop - 4,
                  bottom: 4,
                }}
              />
              {geometry.columnX.map((x, column) => (
                <div
                  key={COLUMN_LABELS[column]}
                  className={`absolute rounded-md pointer-events-none transition-colors duration-150 ${
                    hoveredColumn === column ? 'bg-button-primary/15' : 'bg-transparent'
                  }`}
                  style={{ left: x - 4, width: geometry.cardW + 8, top: geometry.poolTop, bottom: 8 }}
                >
                  <div className="text-center text-xs text-text-secondary leading-[22px]">
                    {COLUMN_LABELS[column]}
                    {columnCounts[column] > 0 && <span className="opacity-60"> · {columnCounts[column]}</span>}
                  </div>
                </div>
              ))}
              <ScrollThumb
                scroll={poolScroll}
                max={maxScroll}
                left={Math.min(geometry.width - 8, geometry.columnX[SIDEBOARD_COLUMN] + geometry.cardW + 12)}
                top={geometry.stackTop}
                height={geometry.poolBottom - geometry.stackTop}
              />
            </>
          )}
          {geometry && (
            <>
              {packOrder.length === 0 && (
                <div
                  className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 text-text-secondary pointer-events-none"
                  style={{ height: compact ? geometry.height : geometry.packBottom }}
                >
                  {(loading || locked) && <Spinner sm />}
                  <span>{locked ? 'Finishing draft...' : title || 'Waiting for the next pack...'}</span>
                </div>
              )}
              <AnimatePresence>{sprites}</AnimatePresence>
              {packTag && (
                <div
                  className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/75 text-white text-xxs font-semibold whitespace-nowrap pointer-events-none"
                  style={{ zIndex: 700 }}
                >
                  {packTag}
                </div>
              )}
              {packDropTarget && (
                <div
                  className="absolute inset-x-2 top-2 rounded-lg border-2 border-dashed border-[#f59e0b] bg-[#f59e0b]/10 pointer-events-none"
                  style={{ height: geometry.packBottom - 8, zIndex: 50 }}
                />
              )}
              {cornerCards.length > 0 && (
                <div className="absolute left-2 bottom-2 flex gap-1.5" style={{ zIndex: 3050 }}>
                  {cornerCards.map((id) => (
                    <motion.button
                      key={id}
                      type="button"
                      onClick={() => onPoolCardPress?.(id)}
                      className={`block w-12 card-border overflow-hidden shadow-lg ${
                        armedSet.has(id) ? 'ring-[3px] ring-[#f59e0b]' : ''
                      }`}
                      animate={armedSet.has(id) ? { rotate: 0 } : { rotate: [0, 4, 0, -4, 0] }}
                      transition={
                        armedSet.has(id)
                          ? { duration: 0.2 }
                          : { duration: 2.4, ease: 'easeInOut', repeat: Infinity, delay: (id % 7) * 0.17 }
                      }
                    >
                      <FoilCardImage card={cards[id]} />
                    </motion.button>
                  ))}
                </div>
              )}
              {opening && (
                <BoosterPack
                  key={opening.id}
                  x={geometry.packCenterX}
                  y={geometry.packCenterY}
                  width={geometry.cardW * 1.12}
                  height={geometry.cardH * 1.15}
                  art={packArt}
                  name={cubeName}
                  label={opening.label}
                  cardCount={opening.cardCount}
                  onBurst={burstOpening}
                  onDone={endOpening}
                />
              )}
              {compact && (
                // Phones: opens the pool drawer. Over every card, even one being dragged onto it.
                <motion.button
                  type="button"
                  aria-label="Open pool"
                  onClick={() => setPoolOpen(true)}
                  className={`absolute right-0 flex flex-col items-center gap-2 py-3 rounded-l-md border border-r-0 shadow-lg transition-colors ${
                    tabTarget ? 'bg-button-primary/30 border-button-primary' : 'bg-bg-active border-border'
                  }`}
                  style={{ width: TAB_WIDTH, top: '50%', y: '-50%', zIndex: 3100, transformOrigin: '100% 50%' }}
                  animate={readyCards.length > 0 ? { rotate: [0, 3, 0, -3, 0] } : { rotate: 0 }}
                  transition={
                    readyCards.length > 0 ? { duration: 2.4, ease: 'easeInOut', repeat: Infinity } : { duration: 0.2 }
                  }
                >
                  {readyCards.length > 0 ? (
                    <ZapIcon size={14} className="text-[#f59e0b]" />
                  ) : (
                    <ChevronLeftIcon size={16} />
                  )}
                  {/* Pops each time a card lands in the pool. */}
                  <motion.span
                    key={poolIds.size}
                    initial={{ scale: 1.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="text-xs font-semibold"
                  >
                    {poolIds.size}
                  </motion.span>
                  <span
                    className="text-xxs uppercase tracking-widest text-text-secondary"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    Pool
                  </span>
                </motion.button>
              )}
            </>
          )}
        </div>

        {compact && (
          <PoolTray
            open={poolOpen}
            onClose={() => setPoolOpen(false)}
            tab={poolTab}
            onTabChange={setPoolTab}
            cards={cards}
            mainboard={mainboard}
            sideboard={sideboard}
            onToggle={togglePoolCard}
            readyCards={readyCards}
            armedCards={armedCards}
            onPress={onPoolCardPress}
            notes={notes}
            removed={removed}
          />
        )}
        {effects}
      </div>
    </div>
  );
};

export default DraftTable;
