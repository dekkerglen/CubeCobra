import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ChevronLeftIcon, ChevronRightIcon, CpuIcon } from '@primer/octicons-react';
import { cardName, makeSubtitle } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import { getCardDefaultRowColumn } from '@utils/draftutil';
import { AnimatePresence, motion, useMotionValue } from 'framer-motion';

import AutocardContext from '../../../contexts/AutocardContext';
import DisplayContext from '../../../contexts/DisplayContext';
import TagColorContext from '../../../contexts/TagColorContext';
import DraftLocation from '../../../drafting/DraftLocation';
import Button from '../../base/Button';
import Link from '../../base/Link';
import Spinner from '../../base/Spinner';
import Text from '../../base/Text';
import BoosterPack from './BoosterPack';
import CardSprite, { EnterFrom, ExitPlan, PASS_OUT_SECONDS, SpriteId } from './CardSprite';
import { isCompactWidth } from './deckLayout';
import DeckTable from './DeckTable';
import { PhoneMenuButton, PhoneMenuPanel } from './PhoneMenu';
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
  // The largest pack in the draft; phones size the pack's rows for it.
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
type DropTarget =
  { kind: 'pack'; index: number } | { kind: 'pool'; column: number; index: number } | { kind: 'tab' } | null;

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
  return a.kind === 'tab' && b.kind === 'tab';
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
 * else eases out of the way. Tap a pack card to raise it, tap again to draft it.
 *
 * On phones the table holds only the pack, laid out in rows; the pool is a
 * drawer that slides in from a tab on the right and works like the deckbuilder.
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
}) => {
  const { showCard, hideCard } = useContext(AutocardContext);
  const { showCustomImages } = useContext(DisplayContext);
  const tagColors = useContext(TagColorContext);

  const tableRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const [customOrder, setCustomOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);

  // The handlers are defined further down; these wrappers only run on pointer events.
  const dragger = useCardDrag<DropTarget>({
    stageRef,
    locate: (id) => locate(Number(id)),
    target: (session, left, top) => computeTarget(session, left, top),
    sameTarget,
    drop: (session, target) => drop(session, target),
    click: (id) => click(Number(id)),
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
    if (!el) return undefined;
    const measure = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const compact = stageSize.width > 0 && isCompactWidth(stageSize.width);
  // Sized for the largest pack, so cards keep their size as the pack shrinks.
  const capacity = Math.max(packSize ?? 0, pack.length);
  const geometry: TableGeometry | null = useMemo(() => {
    if (stageSize.width <= 0 || stageSize.height <= 0) return null;
    return compact
      ? computeRowsGeometry(stageSize.width, stageSize.height, capacity, TAB_WIDTH)
      : computeGeometry(stageSize.width, stageSize.height);
  }, [stageSize.width, stageSize.height, compact, capacity]);

  // Phones: once, ease the page down so the table exactly fills the screen.
  const broughtIntoView = useRef(false);
  useEffect(() => {
    if (!compact || broughtIntoView.current) return;
    broughtIntoView.current = true;
    const table = tableRef.current;
    if (table) window.scrollTo({ top: window.scrollY + table.getBoundingClientRect().top, behavior: 'smooth' });
  }, [compact]);

  const columns = useMemo(() => buildColumns(mainboard, sideboard), [mainboard, sideboard]);
  const poolIds = useMemo(() => new Set(columns.flat().flatMap((segment) => segment.ids)), [columns]);

  // A pick made while bots are still thinking is already in the pool but still
  // in the pack; the pool copy wins.
  const packIds = useMemo(
    () => pack.filter((id, index) => index !== pendingPick && !poolIds.has(id) && cards[id]),
    [pack, pendingPick, poolIds, cards],
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
  // Drafting by dropping into the pool; trash steps are click-only.
  const canPlaceFromPack = canCommit && !isTrashStep;

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
    if (!geometry.rows) {
      columns.forEach((segments, column) => {
        const ids = segments.flatMap((segment) => segment.ids).filter((id) => id !== draggedId);
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
          const ids = segments.flatMap((segment) => segment.ids);
          const index = ids.indexOf(draggedId);
          if (index >= 0) {
            const pose = stackSlot(geometry, column, index);
            result.set(draggedId, { pose, z: 10 + index, zone: 'pool' });
          }
        });
      }
    }
    return result;
  }, [geometry, packOrder, columns, drag, activeSelected, hovered]);

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
    const passed = packLeft || turnover.passPending;
    const entered = packIds.some((id) => !turnover.seen.has(id));
    // A pack opened mid-draft, or the first pick on load, gets the full opening.
    // Reloading partway through a pack just deals the cards back out.
    const unwrapped = entered && !passed && (turnover.signature !== '' || pickNumber === 1);
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
      passPending: passed && !entered,
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
        segments.reduce((sum, segment) => sum + segment.ids.length, 0) +
        (drag?.target?.kind === 'pool' && drag.target.column === column ? 1 : 0),
    ),
  );
  const maxScroll = geometry && !geometry.rows ? maxPoolScroll(geometry, tallestStack) : 0;
  useClampScroll(poolScroll, maxScroll);
  const scrollRegions: ScrollRegion[] =
    geometry && !geometry.rows
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
    const stack =
      columns
        .find((segments) => segments.some((segment) => segment.ids.includes(id)))
        ?.flatMap((segment) => segment.ids) ?? [];
    // The last card in a stack shows its whole face, the others just their name bar.
    const top = placement.pose.y;
    const bottom = top + (stack[stack.length - 1] === id ? geometry.cardH : geometry.bar);
    revealInView(poolScroll, top, bottom, geometry.stackTop, geometry.poolBottom, maxScroll);
  });

  // ---- Drag and click ----
  const locate = (id: number) =>
    placements.has(id)
      ? { zone: packIdSet.has(id) ? 'pack' : 'pool', scroll: packIdSet.has(id) ? null : poolScroll }
      : null;

  const computeTarget = (s: DragSession, left: number, top: number): DropTarget => {
    if (!geometry) return null;
    const centerX = left + geometry.cardW / 2;
    // Pack or pool by where the card is held, like the pool's edge scrolling.
    const pointerY = top + s.grabY;

    if (geometry.rows) {
      if (s.zone !== 'pack') return null;
      if (left + s.grabX >= geometry.width - TAB_DROP_ZONE) return canPlaceFromPack ? { kind: 'tab' } : null;
      return {
        kind: 'pack',
        index: nearestPackSlot(geometry, packOrder.length, centerX, top + geometry.cardH / 2),
      };
    }

    if (pointerY < geometry.packBottom) {
      // Pool cards can't go back into the pack.
      if (s.zone !== 'pack') return null;
      return { kind: 'pack', index: nearestPackSlot(geometry, packOrder.length, centerX, top + geometry.cardH / 2) };
    }

    if (s.zone === 'pack' && !canPlaceFromPack) return null;
    if (locked) return null;
    const column = columnAt(geometry, centerX);
    if (column === null) return null;
    const count = columns[column].flatMap((segment) => segment.ids).filter((id) => id !== s.id).length;
    return { kind: 'pool', column, index: stackInsertIndex(geometry, top + poolScroll.get(), count) };
  };

  // Turn a visual position in a column into a stored location. Indices are
  // computed with the dragged card already removed, which is how the page's
  // move handler applies them. At a boundary between piles (e.g. the last
  // creature / first non-creature) the card's natural pile wins.
  const resolveLocation = (id: number, column: number, index: number): DraftLocation => {
    const segments = columns[column].map((segment) => ({
      ...segment,
      ids: segment.ids.filter((other) => other !== id),
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
    return segment.board === 'deck'
      ? DraftLocation.deck(segment.row, segment.col, at)
      : DraftLocation.sideboard(segment.row, segment.col, at);
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

  const click = (id: number) => {
    if (!packIdSet.has(id)) return;
    if (activeSelected !== id) {
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
      if (geometry?.rows) exitPlan.current.picked.add(id);
      onPick(packIndex);
    }
  };

  // ---- The pool drawer (phones) ----
  const movePoolCard = (source: DraftLocation, target: DraftLocation) => {
    if (!locked) onMovePoolCard(source, target);
  };
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
      if (card) showCard(card, showCustomImages, tagColors);
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
  const columnCounts = columns.map((segments) => segments.reduce((sum, segment) => sum + segment.ids.length, 0));
  const hoveredColumn = drag?.target?.kind === 'pool' ? drag.target.column : null;
  const hasRatings = ratingById.size > 0;

  const sprites: React.ReactNode[] = [];
  placements.forEach((placement, id) => {
    const card = cards[id];
    if (!card) return;
    const rating = ratingById.get(id);
    const isSelected = id === activeSelected;
    const isTop = showRatings && rating !== undefined && rating === maxRating && maxRating > 0;
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
        highlight={isSelected ? 'selected' : isTop ? 'top' : null}
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
        {isSelected && compact && (
          // No room below a card in the rows, so the label sits on the card.
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
        {isSelected && !compact && (
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

  return (
    // Exactly one viewport tall (less the phone's bottom nav) regardless of the
    // header above it: scroll past the header and the table fills the screen.
    // Edge to edge on phones.
    <div
      ref={tableRef}
      className="relative mt-3 flex flex-col bg-bg-accent/80 shadow rounded-md border border-border overflow-hidden max-md:-mx-2 max-md:rounded-none max-md:border-x-0"
      style={{ height: 'calc(100dvh - var(--bottom-nav-height, 0px))', minHeight: 480 }}
    >
      {compact ? (
        // The menu drops over the table rather than pushing it down, so the cards keep their size.
        <div className="relative z-10 border-b border-border">
          <div className="flex items-center gap-2 py-1 px-2">
            <div className="flex flex-col min-w-0">
              <Text semibold className="truncate">
                {title}
              </Text>
              {pendingPick !== null && (
                <Text xs className="text-text-secondary">
                  Waiting for Bot Picks...
                </Text>
              )}
            </div>
            {hasMenu && (
              <div className="ml-auto">
                <PhoneMenuButton open={menuOpen} onToggle={() => setMenuOpen((open) => !open)} label="Draft options" />
              </div>
            )}
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 px-4 border-b border-border">
          <div className="flex flex-col min-w-0">
            <Text semibold lg className="whitespace-nowrap">
              {title}
            </Text>
            {pendingPick !== null && (
              <Text xs className="text-text-secondary">
                Waiting for Bot Picks...
              </Text>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Text xs className="text-text-secondary">
              {makeSubtitle(mainboardCards.filter(Boolean))}
            </Text>
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
        {geometry && !geometry.rows && (
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
                style={{ height: geometry.rows ? geometry.height : geometry.packBottom }}
              >
                {(loading || locked) && <Spinner sm />}
                <span>{locked ? 'Finishing draft...' : title || 'Waiting for the next pack...'}</span>
              </div>
            )}
            <AnimatePresence>{sprites}</AnimatePresence>
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
            {geometry.rows && (
              // Phones: opens the pool drawer. Over every card, even one being dragged onto it.
              <button
                type="button"
                aria-label="Open pool"
                onClick={() => setPoolOpen(true)}
                className={`absolute right-0 flex flex-col items-center gap-2 py-3 rounded-l-md border border-r-0 shadow-lg transition-colors ${
                  tabTarget ? 'bg-button-primary/30 border-button-primary' : 'bg-bg-active border-border'
                }`}
                style={{ width: TAB_WIDTH, top: '50%', transform: 'translateY(-50%)', zIndex: 3100 }}
              >
                <ChevronLeftIcon size={16} />
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
              </button>
            )}
          </>
        )}
      </div>

      {compact && (
        // Phones: the pool, sliding in over the whole table. Stays mounted so it keeps its scroll.
        <motion.div
          className="absolute inset-0 z-20"
          initial={false}
          animate={{ x: poolOpen ? '0%' : '100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          inert={!poolOpen}
        >
          <DeckTable
            cards={cards}
            mainboard={mainboard}
            sideboard={sideboard}
            fill
            headerStart={
              <button
                type="button"
                aria-label="Close pool"
                onClick={() => setPoolOpen(false)}
                className="shrink-0 p-1 text-text-secondary hover:text-text"
              >
                <ChevronRightIcon size={20} />
              </button>
            }
            onMove={movePoolCard}
            onToggleBoard={togglePoolCard}
          />
        </motion.div>
      )}
    </div>
  );
};

export default DraftTable;
