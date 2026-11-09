import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  AppsIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CpuIcon,
  ScreenFullIcon,
  StackIcon,
  VersionsIcon,
} from '@primer/octicons-react';
import { cardName, makeSubtitle } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import { getCardDefaultRowColumn } from '@utils/draftutil';
import { animate, AnimatePresence, motion, MotionValue, useMotionValue, useTransform } from 'framer-motion';

import AutocardContext from '../../../contexts/AutocardContext';
import DisplayContext from '../../../contexts/DisplayContext';
import TagColorContext from '../../../contexts/TagColorContext';
import UserContext from '../../../contexts/UserContext';
import DraftLocation from '../../../drafting/DraftLocation';
import useLocalStorage from '../../../hooks/useLocalStorage';
import Button from '../../base/Button';
import Link from '../../base/Link';
import Spinner from '../../base/Spinner';
import Text from '../../base/Text';
import BoosterPack from './BoosterPack';
import CardSprite, { EnterFrom, ExitPlan, PASS_OUT_SECONDS, SpriteId, VOUCHER_CHARGE_SECONDS } from './CardSprite';
import { isCompactWidth } from './deckLayout';
import HiddenCards from './HiddenCards';
import Scrollbar from './Scrollbar';
import { PhoneMenuButton, PhoneMenuPanel } from './PhoneMenu';
import {
  COLUMN_LABELS,
  columnAt,
  computeGeometry,
  computeGridGeometry,
  computeSplitPool,
  focusPose,
  MAX_PACK_ZOOM,
  MIN_PACK_ZOOM,
  PACK_SCROLLBAR_WIDTH,
  gatherPose,
  MAIN_COLUMNS,
  nearestPackSlot,
  PackLayout,
  packSlots,
  peekPose,
  poolBandAt,
  poolBandTops,
  poolBottom,
  poolStackHeight,
  Pose,
  SIDEBOARD_COLUMN,
  SPLIT_HANDLE_HEIGHT,
  SPLIT_HANDLE_WIDTH,
  SPLIT_LABEL_HEIGHT,
  SPLIT_SCROLLBAR_HEIGHT,
  SPLIT_TABS_HEIGHT,
  splitColumnAt,
  splitPackHeight,
  SplitPool,
  splitSlot,
  stackInsertIndex,
  stackSlot,
  TableGeometry,
} from './tableLayout';
import { DragSession, ScrollRegion, useCardDrag, useClampScroll } from './useCardDrag';

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

// One stored pile that feeds a pool column. A CMC column has a stack for each
// band, the creature row above the non-creature row; the sideboard column shows
// all its piles in order as one stack.
interface Segment {
  board: 'deck' | 'sideboard';
  row: number;
  col: number;
  ids: number[];
}

// 'packDrop': a pool card dropped onto the pack to use it (Cogwork Librarian).
// 'board': a board's tab over the pool on a phone, which puts the card in its natural spot there.
type DropTarget =
  | { kind: 'pack'; index: number }
  | { kind: 'pool'; column: number; band: number; index: number }
  | { kind: 'board'; board: 'deck' | 'sideboard' }
  | { kind: 'packDrop' }
  | null;

type Zone = 'pack' | 'pool';
// Phones: which of the pool's boards shows under the pack.
type PoolTab = 'mainboard' | 'sideboard' | 'removed';

interface Placement {
  pose: Pose;
  z: number;
  zone: Zone;
}

// passed: slides in from the neighbor; burst: pops out of a pack being opened;
// opened: deals out from the middle (a pack already in progress on load); pool: fades in place,
// or flies out of the voucher it was in.
type EnterKind = 'passed' | 'burst' | 'opened' | 'pool';

interface Turnover {
  signature: string;
  pack: number[];
  seen: Set<number>;
  // Cards left but the next pack hasn't arrived yet.
  passPending: boolean;
  // How each newly seen card should enter the table.
  kinds: Map<number, EnterKind>;
  // The cards inside a voucher just drafted, flying out of it as it bursts.
  flung: Map<number, EnterFrom>;
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

// Desktop: px below the pool's stacks.
const POOL_PAD = 12;

const LINK_CLASS =
  'flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2';

const EMPTY_TURNOVER: Turnover = {
  signature: '',
  pack: [],
  seen: new Set(),
  passPending: false,
  kinds: new Map(),
  flung: new Map(),
  openings: 0,
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// The cards inside a drafted voucher, bursting out of it: from its middle out to a spiral
// around it (kept on the stage), then one by one into their spots in the pool. `from` is the
// voucher as drawn, in stage pixels, and `packCardW` the width of a pack card not grown to be
// read; `card` is the size the pool draws its cards, and `shiftX` how far the pool is scrolled
// sideways.
const flingOut = (
  from: { x: number; y: number; width: number; height: number; rotate: number },
  packCardW: number,
  ids: number[],
  card: { width: number; height: number },
  stage: { width: number; height: number },
  shiftX: number,
): Map<number, EnterFrom> => {
  const entrances = new Map<number, EnterFrom>();
  const centerX = from.x + from.width / 2;
  const centerY = from.y + from.height / 2;
  // They start at the voucher's size (sprites scale about their bottom middle), and fly at
  // most the size of a pack card.
  const startScale = from.width / card.width;
  const flungScale = Math.max(1, (packCardW / card.width) * 0.8);
  const flungW = card.width * flungScale;
  const flungH = card.height * flungScale;
  const reach = packCardW * (0.8 + 0.2 * Math.sqrt(ids.length));
  const stagger = Math.min(0.5, 0.025 * ids.length);
  ids.forEach((id, index) => {
    const along = Math.sqrt((index + 0.5) / ids.length);
    const angle = index * GOLDEN_ANGLE;
    const x = Math.max(flungW / 2, Math.min(stage.width - flungW / 2, centerX + Math.cos(angle) * reach * along * 1.5));
    const y = Math.max(flungH / 2, Math.min(stage.height - flungH / 2, centerY + Math.sin(angle) * reach * along));
    entrances.set(id, {
      x: centerX - card.width / 2 + shiftX,
      y: centerY - card.height + (card.height * startScale) / 2,
      rotate: from.rotate,
      scale: startScale,
      opacity: 0,
      delay: VOUCHER_CHARGE_SECONDS,
      fling: true,
      via: {
        x: x - card.width / 2 + shiftX,
        y: y - card.height + flungH / 2,
        rotate: ((id * 37) % 31) - 15,
        scale: flungScale,
      },
      hold: 0.15 + (ids.length > 1 ? (index / (ids.length - 1)) * stagger : 0),
    });
  });
  return entrances;
};

const sameTarget = (a: DropTarget, b: DropTarget): boolean => {
  if (a === null || b === null) return a === b;
  if (a.kind === 'pack' && b.kind === 'pack') return a.index === b.index;
  if (a.kind === 'pool' && b.kind === 'pool') return a.column === b.column && a.band === b.band && a.index === b.index;
  if (a.kind === 'board' && b.kind === 'board') return a.board === b.board;
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
 * On phones the pack is a grid in the top two thirds of the table, and the pool
 * a row of stacks below it, one board at a time, that scrolls sideways. The
 * pool's tab pulls it up to the bottom two thirds, and holding a pool card
 * shows it bigger.
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
  // The player turned animations off: packs arrive and leave at once, with no
  // opening or passing, and a held card doesn't lean as it moves.
  const animationsOff = useContext(UserContext)?.disableAnimations ?? false;

  // The room the table has, before its own margins: what decides the phone layout.
  const roomRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [roomWidth, setRoomWidth] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  // Desktop: the window's room for the stage, which sizes the cards. The table
  // itself grows past it as the pool does, and the page scrolls.
  const [viewRoom, setViewRoom] = useState(0);
  const [packLayout, setPackLayout] = useLocalStorage<PackLayout>('draftPackLayout', 'fan');
  // Phones: how far the pool's row of stacks, under the pack, is scrolled sideways.
  const poolScrollX = useMotionValue(0);
  const poolShift = useTransform(poolScrollX, (value) => -value);
  // Phones: how far the pack's part is scrolled down, when a pinch makes its cards too big to fit.
  const packScroll = useMotionValue(0);
  // Phones: how big a pinch has left the pack's and the pool's cards (kept for next time), and
  // the pinch going on now, in one or the other.
  const [packZoom, setPackZoom] = useLocalStorage<number>('draftPackZoom', 1);
  const [poolZoom, setPoolZoom] = useLocalStorage<number>('draftPoolZoom', 1);
  const [pinching, setPinching] = useState<{ region: 'pack' | 'pool'; zoom: number } | null>(null);
  const livePackZoom = pinching?.region === 'pack' ? pinching.zoom : packZoom;
  const livePoolZoom = pinching?.region === 'pool' ? pinching.zoom : poolZoom;
  // Phones: the pool pulled up to take the bottom two thirds (kept for next time), and
  // the pool card held to be read.
  const [poolExpanded, setPoolExpanded] = useLocalStorage<boolean>('draftPoolExpanded', false);
  const [peeked, setPeeked] = useState<number | null>(null);

  const [customOrder, setCustomOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [poolTab, setPoolTab] = useState<PoolTab>('mainboard');

  // The handlers are defined further down; these wrappers only run on pointer events.
  // Decided by the room rather than the stage, since the phone layout drops the
  // table's margins and so widens the stage: deciding by the stage could flip back and forth.
  const compact = roomWidth > 0 && isCompactWidth(roomWidth);

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
    // Desktop: holding a card at the top or bottom of the window scrolls the page.
    // Phones: nothing here scrolls the page; a swipe on the stage does, natively (see its touch-action).
    verticalScroller: () => (compact ? null : window),
    // Phones: a touch picks a card up as soon as it moves, as a mouse does; a tap enlarges it.
    touchPicksUp: compact,
    // ...and holding a pool card in place shows it bigger.
    peek: (id) => peek(Number(id)),
    endPeek: () => setPeeked(null),
    lean: !animationsOff,
    // Phones with the pool on the table: its row of stacks scrolls sideways.
    horizontalAt: (_x, y) => (splitPool && y >= splitPool.top ? { scroll: poolScrollX, max: maxPoolScrollX } : null),
    // ...and the pack's part scrolls down when zoomed in past fitting.
    scrollRegions: () => (packRegion ? [packRegion] : []),
  });
  const { drag } = dragger;

  useLayoutEffect(() => {
    const el = stageRef.current;
    const room = roomRef.current;
    if (!el || !room) return undefined;
    const measure = () => {
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
      setRoomWidth(room.clientWidth);
      // The window less any bar fixed over its bottom (see CubeBottomNav), the header, and the table's border.
      const covered =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height')) || 0;
      setViewRoom(window.innerHeight - covered - (headerRef.current?.offsetHeight ?? 0) - 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(room);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // The pack as it was dealt for this pick. The page drops a card from the pack
  // as soon as it's drafted, while the bots still pick; it keeps its place here
  // until the next pick, so what's left holds its layout until the pack is passed.
  const [dealt, setDealt] = useState<{ key: string; cards: number[] }>({ key: '', cards: [] });
  const dealtKey = `${packNumber}:${pickNumber}`;
  if (dealtKey !== dealt.key || [...pack, ...inPack].some((id) => !dealt.cards.includes(id))) {
    setDealt({ key: dealtKey, cards: [...pack, ...inPack] });
  }
  // Phones lay out the pack as it is, so a pack of 15 always looks the same and
  // cards grow as the pack shrinks. Desktop is sized for the largest pack, so
  // neither the cards nor the pack area change as the pack shrinks.
  const packCount = dealt.cards.length;
  const capacity = Math.max(packSize ?? 0, packCount);
  const geometry: TableGeometry | null = useMemo(() => {
    if (stageSize.width <= 0) return null;
    if (compact) {
      if (stageSize.height <= 0) return null;
      return computeGridGeometry(
        stageSize.width,
        splitPackHeight(stageSize.height, poolExpanded),
        packCount,
        livePackZoom,
      );
    }
    return viewRoom > 0 ? computeGeometry(stageSize.width, viewRoom, capacity, packLayout) : null;
  }, [
    stageSize.width,
    stageSize.height,
    compact,
    packCount,
    livePackZoom,
    poolExpanded,
    viewRoom,
    capacity,
    packLayout,
  ]);

  // Phones: the pack's part scrolls when its cards run past the bottom, back to the top for each pick.
  const packMax = geometry && compact ? Math.max(0, Math.ceil(geometry.contentHeight - geometry.height)) : 0;
  useClampScroll(packScroll, packMax);
  useEffect(() => packScroll.set(0), [dealt.key, packScroll]);
  const packRegion: ScrollRegion | null =
    geometry && compact
      ? { left: 0, right: geometry.width, top: 0, bottom: geometry.height, scroll: packScroll, max: packMax }
      : null;

  // Phones: scroll the page so the table exactly fills the screen; once on its
  // own, and again from the header's button.
  const fitToScreen = useCallback(() => {
    const table = tableRef.current;
    if (table) window.scrollTo({ top: window.scrollY + table.getBoundingClientRect().top, behavior: 'smooth' });
  }, []);
  const broughtIntoView = useRef(false);
  useEffect(() => {
    if (!compact || broughtIntoView.current) return;
    broughtIntoView.current = true;
    fitToScreen();
  }, [compact, fitToScreen]);

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
  // Cards just put at the end of their pile, by a click or tap draft, a drop on a tab,
  // or a click to the other board, latest last. Where a stack runs several piles
  // together (a phone's mainboard column, the desktop sideboard column), the pile
  // holding the latest of them goes last, so that card is the one in full view.
  const placed = useRef({ next: 1, order: new Map<number, number>() });
  const markPlaced = (id: number) => {
    // A voucher is placed as the cards inside it.
    for (const placedId of [id, ...(cards[id]?.voucher_card_indices ?? [])]) {
      placed.current.order.set(placedId, placed.current.next);
      placed.current.next += 1;
    }
  };
  const latestLast = (segments: Segment[]) => {
    const latest = (segment: Segment) => Math.max(0, ...segment.ids.map((id) => placed.current.order.get(id) ?? 0));
    return [...segments].sort((a, b) => latest(a) - latest(b));
  };

  // The pool's stacks as drawn, by column then band: a CMC column's creatures and
  // everything else, and the sideboard column's piles as one stack.
  const poolStacks = useMemo(
    () =>
      columns.map((segments, column) =>
        column === SIDEBOARD_COLUMN
          ? [shownInColumn(latestLast(segments))]
          : segments.map((segment) => segment.ids.filter((id) => !inPackSet.has(id))),
      ),
    // latestLast only reads the placed order, which changes along with columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, shownInColumn, inPackSet],
  );
  // Phones: the pool's tabs, side by side across the stage, and the middle of one.
  const poolTabs: PoolTab[] = removed.length > 0 ? ['mainboard', 'sideboard', 'removed'] : ['mainboard', 'sideboard'];
  const tabCenter = (tab: PoolTab) => ({
    x: ((poolTabs.indexOf(tab) + 0.5) * stageSize.width) / poolTabs.length,
    y: (splitPool?.top ?? 0) + SPLIT_TABS_HEIGHT / 2,
  });
  // Showing another board: cards that were headed into its tab simply go.
  const showBoard = (tab: PoolTab) => {
    exitPlan.current.toward.clear();
    setPoolTab(tab);
  };

  // Phones with the pool on the table: the shown board's stacks in one row. A
  // mainboard column runs its creatures then the rest; removed cards get a column each.
  const removedSet = useMemo(() => new Set(removed), [removed]);
  const splitColumns: Segment[][] = useMemo(() => {
    if (poolTab === 'removed') return [];
    if (poolTab === 'sideboard') return (columns[SIDEBOARD_COLUMN] ?? []).map((segment) => [segment]);
    return columns.slice(0, MAIN_COLUMNS).map(latestLast);
    // latestLast only reads the placed order, which changes along with columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, poolTab]);
  const splitStacks: number[][] = useMemo(
    () =>
      poolTab === 'removed'
        ? removed.filter((id) => cards[id]).map((id) => [id])
        : splitColumns.map((segments) => shownInColumn(segments)),
    [poolTab, removed, cards, splitColumns, shownInColumn],
  );
  const draggingId = drag ? Number(drag.id) : null;
  const splitTallest = Math.max(
    0,
    ...splitStacks.map(
      (ids, column) =>
        ids.filter((id) => id !== draggingId).length +
        (drag?.target?.kind === 'pool' && drag.target.column === column ? 1 : 0),
    ),
  );
  const splitPool: SplitPool | null = useMemo(
    () =>
      compact && stageSize.width > 0 && stageSize.height > 0
        ? computeSplitPool(
            stageSize.width,
            stageSize.height,
            splitStacks.length,
            splitTallest,
            poolExpanded,
            livePoolZoom,
          )
        : null,
    [compact, stageSize.width, stageSize.height, splitStacks.length, splitTallest, poolExpanded, livePoolZoom],
  );
  const maxPoolScrollX = splitPool ? Math.max(0, Math.ceil(splitPool.contentWidth - stageSize.width)) : 0;
  useClampScroll(poolScrollX, maxPoolScrollX);

  // The tallest stack in a band of the CMC columns, leaving out one card and/or making room for one.
  const tallestInBand = (band: number, without: number | null, gap: DropTarget) =>
    Math.max(
      0,
      ...poolStacks
        .slice(0, MAIN_COLUMNS)
        .map(
          (stacks, column) =>
            (stacks[band] ?? []).filter((id) => id !== without).length +
            (gap?.kind === 'pool' && gap.column === column && gap.band === band ? 1 : 0),
        ),
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
  // The same, with cards already drafted from the pack still in it: they leave
  // their spots empty until the next pack arrives, so the rest hold still until
  // the pack is passed.
  const dealtOrder = useMemo(() => {
    const onTable = dealt.cards.filter((id) => cards[id]);
    const onTableSet = new Set(onTable);
    const kept = customOrder.filter((id) => onTableSet.has(id));
    const keptSet = new Set(kept);
    return [...kept, ...onTable.filter((id) => !keptSet.has(id))];
  }, [customOrder, dealt, cards]);

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

    // Rearranging the pack closes up any empty spots.
    const fan = drag ? packOrder.filter((id) => id !== draggedId) : dealtOrder;
    const gapAt = target?.kind === 'pack' ? target.index : -1;
    const slots = packSlots(geometry, fan.length + (gapAt >= 0 ? 1 : 0));
    let slot = 0;
    fan.forEach((id) => {
      if (slot === gapAt) slot += 1;
      // A drafted card's empty spot.
      if (!packIdSet.has(id)) {
        slot += 1;
        return;
      }
      const base = slots[slot];
      let pose = base;
      let z = 100 + slot;
      if (id === activeSelected) {
        // Phones grow the card to be read; elsewhere it lifts.
        pose = compact
          ? focusPose(geometry, base, packScroll.get())
          : { x: base.x, y: base.y - geometry.raise, rotate: 0 };
        z = 600;
      } else if (id === hovered && !drag) {
        pose = { x: base.x, y: base.y - geometry.peek, rotate: 0 };
        z = 500;
      }
      result.set(id, { pose, z, zone: 'pack' });
      slot += 1;
    });

    // Phones with the pool on the table: the shown board's stacks in a row under the pack.
    if (splitPool) {
      splitStacks.forEach((stack, column) => {
        const gap = target?.kind === 'pool' && target.column === column ? target.index : -1;
        let index = 0;
        stack
          .filter((id) => id !== draggedId)
          .forEach((id) => {
            if (index === gap) index += 1;
            const slot = splitSlot(splitPool, column, index);
            // A card held to be read grows over everything, the pool's tabs included.
            result.set(
              id,
              id === peeked
                ? { pose: peekPose(splitPool, geometry.width, slot, poolScrollX.get()), z: 800, zone: 'pool' }
                : { pose: slot, z: 10 + index, zone: 'pool' },
            );
            index += 1;
          });
      });
    }

    // Otherwise phones keep the pool in a drawer, off the stage.
    const bandTops = poolBandTops(geometry, tallestInBand(0, draggedId, target));
    if (!compact) {
      poolStacks.forEach((stacks, column) =>
        stacks.forEach((stack, band) => {
          const gap = target?.kind === 'pool' && target.column === column && target.band === band ? target.index : -1;
          let index = 0;
          stack
            .filter((id) => id !== draggedId)
            .forEach((id) => {
              if (index === gap) index += 1;
              result.set(id, { pose: stackSlot(geometry, bandTops, column, band, index), z: 10 + index, zone: 'pool' });
              index += 1;
            });
        }),
      );
    }

    // The dragged card keeps its home placement, so an illegal drop eases it back there.
    if (draggedId !== null) {
      const homeSlot = packOrder.indexOf(draggedId);
      if (homeSlot >= 0) {
        const pose = packSlots(geometry, packOrder.length)[homeSlot];
        result.set(draggedId, { pose, z: 100 + homeSlot, zone: 'pack' });
      } else if (splitPool) {
        splitStacks.forEach((stack, column) => {
          const index = stack.indexOf(draggedId);
          if (index >= 0)
            result.set(draggedId, { pose: splitSlot(splitPool, column, index), z: 10 + index, zone: 'pool' });
        });
      } else {
        poolStacks.forEach((stacks, column) =>
          stacks.forEach((stack, band) => {
            const index = stack.indexOf(draggedId);
            if (index >= 0) {
              const pose = stackSlot(geometry, bandTops, column, band, index);
              result.set(draggedId, { pose, z: 10 + index, zone: 'pool' });
            }
          }),
        );
      }
    }
    return result;
    // tallestInBand only reads poolStacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    geometry,
    compact,
    packOrder,
    dealtOrder,
    packIdSet,
    poolStacks,
    splitPool,
    splitStacks,
    drag,
    activeSelected,
    hovered,
    peeked,
  ]);

  // Where each card was drawn as of the last render, for one that has just left (a voucher, bursting).
  const drawnBefore = useRef(placements);
  useLayoutEffect(() => {
    drawnBefore.current = placements;
  });

  // Phones: the tops of the pack's cards in its scrolled content, to count those scrolled out of view.
  const packTops = useMemo(
    () => [...placements.values()].filter((placement) => placement.zone === 'pack').map(({ pose }) => pose.y),
    [placements],
  );

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
    toward: new Map(),
    passInstantly: false,
    burst: new Set(),
  });
  useLayoutEffect(() => {
    // Leaving cards read this from their (passive) exit effects, which run after layout effects.
    exitPlan.current.passInstantly = animationsOff;
    exitPlan.current.direction = passesLeft ? -1 : 1;
    exitPlan.current.stageWidth = stageSize.width;
    if (geometry) {
      const pile = gatherPose(geometry);
      exitPlan.current.gatherX = pile.x;
      exitPlan.current.gatherY = pile.y;
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
    // A voucher drafted from the pack gives way to the cards inside it, which show up in the pool.
    const opened = turnover.pack.filter(
      (id) =>
        !packIdSet.has(id) &&
        (cards[id]?.voucher_card_indices ?? []).some((inside) => poolIds.has(inside) && !turnover.seen.has(inside)),
    );
    const packLeft = turnover.pack.some((id) => !packIdSet.has(id) && !poolIds.has(id) && !opened.includes(id));
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
    // It bursts where it's drawn, and the cards inside it that the pool shows fly out of it.
    const flung = new Map<number, EnterFrom>();
    if (!animationsOff) {
      opened.forEach((voucher) => {
        const handle = dragger.handle(voucher);
        const inside = (cards[voucher]?.voucher_card_indices ?? []).filter(
          (id) => !turnover.seen.has(id) && placements.get(id)?.zone === 'pool',
        );
        if (!handle || inside.length === 0) return;
        // A card grown to be read grows about its bottom middle.
        const grown = drawnBefore.current.get(voucher)?.pose.scale ?? 1;
        const width = geometry.cardW * grown;
        const height = geometry.cardH * grown;
        const from = {
          x: handle.x.get() + (geometry.cardW - width) / 2,
          y: handle.y.get() - (compact ? packScroll.get() : 0) + geometry.cardH - height,
          width,
          height,
          rotate: handle.rotate.get(),
        };
        const poolCard = splitPool
          ? { width: splitPool.cardW, height: splitPool.cardH }
          : { width: geometry.cardW, height: geometry.cardH };
        flingOut(from, geometry.cardW, inside, poolCard, stageSize, splitPool ? poolScrollX.get() : 0).forEach(
          (entrance, id) => flung.set(id, entrance),
        );
        // Read by the voucher's exit, which starts in this render.
        exitPlan.current.burst.add(voucher);
      });
    }
    const openings = turnover.openings + (unwrapped ? 1 : 0);
    if (unwrapped && !animationsOff)
      setOpening({ id: openings, label: packLabel, cardCount: packIds.length, burst: false });
    setTurnover({
      signature: drawnSignature,
      pack: packIds,
      seen: new Set([...packIds, ...poolIds]),
      passPending: leftBefore && !entered,
      kinds,
      flung,
      openings,
    });
  }

  const enterFor = (id: number, placement: Placement): EnterFrom | null => {
    const kind = turnover.kinds.get(id);
    if (!geometry || !kind || animationsOff) return null;
    if (kind === 'pool') return turnover.flung.get(id) ?? { ...placement.pose, opacity: 0, delay: 0 };
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

  // ---- The pool's size ----
  // Stacks never squeeze: the stage grows to hold the tallest, and the page scrolls.
  const draggedNow = drag ? Number(drag.id) : null;
  const gapNow = drag?.target ?? null;
  const tallestNow = [tallestInBand(0, draggedNow, gapNow), tallestInBand(1, draggedNow, gapNow)];
  const sideboardNow =
    (poolStacks[SIDEBOARD_COLUMN]?.[0] ?? []).filter((id) => id !== draggedNow).length +
    (gapNow?.kind === 'pool' && gapNow.column === SIDEBOARD_COLUMN ? 1 : 0);
  const bandTopsNow = geometry ? poolBandTops(geometry, tallestNow[0]) : null;
  const poolContentBottom =
    geometry && bandTopsNow && !compact ? poolBottom(geometry, bandTopsNow, tallestNow[1], sideboardNow) + POOL_PAD : 0;
  // Each stack's place in the pool, for the drop highlights.
  const poolBands: { column: number; band: number; top: number; height: number }[] = [];
  if (geometry && bandTopsNow && !compact) {
    geometry.columnX.forEach((_, column) => {
      if (column === SIDEBOARD_COLUMN) {
        poolBands.push({ column, band: 0, top: geometry.stackTop, height: poolStackHeight(geometry, sideboardNow) });
      } else {
        [0, 1].forEach((band) =>
          poolBands.push({ column, band, top: bandTopsNow[band], height: poolStackHeight(geometry, tallestNow[band]) }),
        );
      }
    });
  }

  // Phones with the pool on the table: once a pick lands, scroll the row so its stack is in view.
  const revealId = useRef<number | null>(null);
  useLayoutEffect(() => {
    const id = revealId.current;
    if (id === null) return;
    const placement = placements.get(id);
    // Still in the pack until the page moves it.
    if (placement?.zone === 'pack') return;
    revealId.current = null;
    if (!placement || !splitPool) return;
    const current = poolScrollX.get();
    const left = placement.pose.x - 6;
    const right = placement.pose.x + splitPool.cardW + 6 - stageSize.width;
    const next = Math.max(0, Math.min(maxPoolScrollX, left < current ? left : right > current ? right : current));
    if (next !== current) animate(poolScrollX, next, { type: 'spring', stiffness: 220, damping: 30 });
  });

  // ---- Pinching (phones) ----
  // Two fingers size the cards of the part they're on, the pack or the pool, each
  // on its own; what's between them stays under them, and the size sticks when they lift.
  const pinch = useRef<{
    region: 'pack' | 'pool';
    spread: number;
    zoom: number;
    // How far a pinch there can size the cards.
    range: [number, number];
    cardW: number;
    // The point between the fingers in that part's content, and where the fingers are now, on screen.
    x: number;
    y: number;
    midX: number;
    midY: number;
  } | null>(null);
  const pinchState = useRef({
    packZoom,
    geometry,
    splitPool,
    cancel: dragger.cancel,
    setPackZoom,
    setPoolZoom,
  });
  useLayoutEffect(() => {
    pinchState.current = { packZoom, geometry, splitPool, cancel: dragger.cancel, setPackZoom, setPoolZoom };
  });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !compact) return undefined;
    const spread = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const middle = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });
    const start = (event: TouchEvent) => {
      const { geometry: g, splitPool: pool } = pinchState.current;
      if (event.touches.length !== 2 || !g || !pool) return;
      pinchState.current.cancel();
      const rect = stage.getBoundingClientRect();
      const mid = middle(event.touches);
      const region = mid.y - rect.top < pool.top ? 'pack' : 'pool';
      // The pool's pinch starts from the size its cards are drawn at, which may be short of the size
      // last pinched to (taller stacks, or the pool put down), so the cards respond at once.
      const zoom = region === 'pack' ? pinchState.current.packZoom : pool.zoom;
      pinch.current = {
        region,
        spread: spread(event.touches),
        zoom,
        range: region === 'pack' ? [MIN_PACK_ZOOM, MAX_PACK_ZOOM] : pool.zoomRange,
        cardW: region === 'pack' ? g.cardW : pool.cardW,
        x: mid.x - rect.left + (region === 'pool' ? poolScrollX.get() : 0),
        y: mid.y - rect.top + (region === 'pack' ? packScroll.get() : 0),
        midX: mid.x,
        midY: mid.y,
      };
      setPinching({ region, zoom });
    };
    const move = (event: TouchEvent) => {
      const p = pinch.current;
      if (!p || event.touches.length !== 2) return;
      event.preventDefault();
      const mid = middle(event.touches);
      p.midX = mid.x;
      p.midY = mid.y;
      const [low, high] = p.range;
      setPinching({
        region: p.region,
        zoom: Math.max(low, Math.min(high, (p.zoom * spread(event.touches)) / p.spread)),
      });
    };
    const end = (event: TouchEvent) => {
      if (!pinch.current || event.touches.length >= 2) return;
      pinch.current = null;
      setPinching((current) => {
        if (current)
          (current.region === 'pack' ? pinchState.current.setPackZoom : pinchState.current.setPoolZoom)(current.zoom);
        return null;
      });
    };
    stage.addEventListener('touchstart', start, { passive: true });
    stage.addEventListener('touchmove', move, { passive: false });
    stage.addEventListener('touchend', end);
    stage.addEventListener('touchcancel', end);
    return () => {
      stage.removeEventListener('touchstart', start);
      stage.removeEventListener('touchmove', move);
      stage.removeEventListener('touchend', end);
      stage.removeEventListener('touchcancel', end);
    };
  }, [compact, packScroll, poolScrollX]);
  // Once the cards have resized, scroll so the point that was between the fingers still is.
  useLayoutEffect(() => {
    const p = pinch.current;
    const stage = stageRef.current;
    if (!p || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (p.region === 'pack' && geometry && p.cardW > 0) {
      const scale = geometry.cardW / p.cardW;
      packScroll.set(Math.max(0, Math.min(packMax, p.y * scale - (p.midY - rect.top))));
    } else if (p.region === 'pool' && splitPool && p.cardW > 0) {
      const scale = splitPool.cardW / p.cardW;
      poolScrollX.set(Math.max(0, Math.min(maxPoolScrollX, p.x * scale - (p.midX - rect.left))));
    }
  }, [geometry, splitPool, packMax, maxPoolScrollX, packScroll, poolScrollX]);

  // ---- Drag and click ----
  // Typed, since the drag hook that calls it is declared before the placements it reads.
  // Removed cards can't be picked up; on a phone, pool cards scroll sideways with their row.
  // Typed, since the drag hook that calls it is declared before the placements it reads.
  const locate = (
    id: number,
  ): { zone: Zone; scroll: MotionValue<number> | null; scrollX: MotionValue<number> | null } | null => {
    if (!placements.has(id) || removedSet.has(id)) return null;
    const zone: Zone = packIdSet.has(id) ? 'pack' : 'pool';
    return {
      zone,
      scroll: zone === 'pack' && compact ? packScroll : null,
      scrollX: zone === 'pool' && splitPool ? poolScrollX : null,
    };
  };

  const computeTarget = (s: DragSession, left: number, top: number): DropTarget => {
    if (!geometry) return null;
    const centerX = left + geometry.cardW / 2;
    // Pack or pool by where the card is held.
    const pointerX = left + s.grabX;
    const pointerY = top + s.grabY;

    const backToPool = inPackSet.has(Number(s.id)) && !locked;
    if (splitPool) {
      // Held over a board's tab: into that board, wherever the card naturally goes there.
      if (pointerY >= splitPool.top && pointerY < splitPool.top + SPLIT_TABS_HEIGHT) {
        const tab = poolTabs[Math.floor((pointerX / stageSize.width) * poolTabs.length)];
        const board = tab === 'mainboard' ? 'deck' : tab === 'sideboard' ? 'sideboard' : null;
        if (!board || locked) return null;
        if (s.zone === 'pack') return canPlaceFromPack || backToPool ? { kind: 'board', board } : null;
        return findPoolLocation(Number(s.id))?.type !== board ? { kind: 'board', board } : null;
      }
      if (pointerY >= splitPool.top) {
        if (locked || poolTab === 'removed') return null;
        if (s.zone === 'pack' && !canPlaceFromPack && !backToPool) return null;
        const heldW = s.zone === 'pool' ? splitPool.cardW : geometry.cardW;
        const column = splitColumnAt(splitPool, left + heldW / 2 + poolScrollX.get());
        if (column === null) return null;
        const count = (splitStacks[column] ?? []).filter((id) => id !== Number(s.id)).length;
        const index = Math.max(0, Math.min(count, Math.round((top - splitPool.stackTop) / splitPool.bar)));
        return { kind: 'pool', column, band: 0, index };
      }
      // Pool cards can't go back into the pack, except to use one (Cogwork Librarian).
      if (s.zone !== 'pack') return poolToPack.includes(Number(s.id)) && !locked ? { kind: 'packDrop' } : null;
      return {
        kind: 'pack',
        // The pack's slots are in its scrolled content.
        index: nearestPackSlot(geometry, packOrder.length, centerX, top + packScroll.get() + geometry.cardH / 2),
      };
    }
    if (compact) return null;

    if (pointerY < geometry.packBottom) {
      // Pool cards can't go back into the pack, except to use one (Cogwork Librarian).
      if (s.zone !== 'pack') return poolToPack.includes(Number(s.id)) && !locked ? { kind: 'packDrop' } : null;
      return { kind: 'pack', index: nearestPackSlot(geometry, packOrder.length, centerX, top + geometry.cardH / 2) };
    }

    if (s.zone === 'pack' && !canPlaceFromPack && !backToPool) return null;
    if (locked) return null;
    const column = columnAt(geometry, centerX);
    if (column === null) return null;
    const bandTops = poolBandTops(geometry, tallestInBand(0, Number(s.id), null));
    const band = column === SIDEBOARD_COLUMN ? 0 : poolBandAt(geometry, bandTops, top);
    const stackTop = column === SIDEBOARD_COLUMN ? geometry.stackTop : bandTops[band];
    const count = (poolStacks[column]?.[band] ?? []).filter((id) => id !== s.id).length;
    return { kind: 'pool', column, band, index: stackInsertIndex(geometry, stackTop, top, count) };
  };

  // Turn a visual position in a stack into a stored location. Indices are
  // computed with the dragged card already removed, which is how the page's
  // move handler applies them. A stack can run several piles together (the
  // sideboard column on desktop, a mainboard column on a phone); at a boundary
  // between two of them the card's natural pile (`preferred`) wins.
  const locationIn = (id: number, piles: Segment[], index: number, preferred: number): DraftLocation => {
    // As drawn: without the dragged card or cards drawn in the pack.
    const segments = piles.map((segment) => ({
      ...segment,
      stored: segment.ids.filter((other) => other !== id),
      ids: segment.ids.filter((other) => other !== id && !inPackSet.has(other)),
    }));
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

  const naturalSpot = (id: number) => (cards[id] ? getCardDefaultRowColumn(cards[id]) : { row: 1, col: 0 });

  // Where a card goes in a board when no spot is picked: the end of its natural pile.
  const naturalLocation = (id: number, board: 'deck' | 'sideboard'): DraftLocation => {
    const { row, col } = naturalSpot(id);
    return board === 'deck'
      ? DraftLocation.deck(row, col, mainboard[row]?.[col]?.length ?? 0)
      : DraftLocation.sideboard(0, col, sideboard[0]?.[col]?.length ?? 0);
  };

  // Desktop: a CMC column's bands are its two piles; the sideboard column runs its piles together.
  const resolveLocation = (id: number, column: number, band: number, index: number): DraftLocation => {
    if (column !== SIDEBOARD_COLUMN) {
      return locationIn(id, [columns[column][Math.min(band, columns[column].length - 1)]], index, 0);
    }
    // In the order drawn, the newest card's pile last.
    const piles = latestLast(columns[column]);
    return locationIn(
      id,
      piles,
      index,
      piles.findIndex((pile) => pile.col === naturalSpot(id).col),
    );
  };

  // Phones with the pool on the table: a stack of the shown board.
  const splitLocation = (id: number, column: number, index: number): DraftLocation => {
    const piles = splitColumns[column] ?? [];
    const preferred = poolTab === 'mainboard' ? piles.findIndex((pile) => pile.row === naturalSpot(id).row) : 0;
    return locationIn(id, piles, index, preferred);
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
    if (inPackSet.has(id) && (target.kind === 'pool' || target.kind === 'board')) {
      onPoolCardPress?.(id);
      return;
    }

    if (target.kind === 'board') {
      // A board that isn't showing takes the card into its tab.
      const tab = target.board === 'deck' ? 'mainboard' : 'sideboard';
      if (tab !== poolTab) exitPlan.current.toward.set(id, tabCenter(tab));
      markPlaced(id);
      if (s.zone === 'pack') {
        const packIndex = pack.indexOf(id);
        if (packIndex >= 0) onPickTo(packIndex, naturalLocation(id, target.board));
        return;
      }
      const source = findPoolLocation(id);
      if (source && source.type !== target.board) onMovePoolCard(source, naturalLocation(id, target.board));
      return;
    }

    if (target.kind === 'pack') {
      const order = packOrder.filter((other) => other !== id);
      order.splice(target.index, 0, id);
      setCustomOrder(order);
      return;
    }

    const location = splitPool
      ? splitLocation(id, target.column, target.index)
      : resolveLocation(id, target.column, target.band, target.index);
    if (s.zone === 'pack') {
      revealId.current = id;
      const packIndex = pack.indexOf(id);
      if (packIndex >= 0) onPickTo(packIndex, location);
      return;
    }

    const source = findPoolLocation(id);
    if (!source) return;
    const unchanged =
      source.type === location.type &&
      source.row === location.row &&
      source.col === location.col &&
      source.index === location.index;
    if (unchanged) return;
    // It stays where it was dropped, rather than taking its pile along to the end.
    placed.current.order.delete(id);
    onMovePoolCard(source, location);
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
        if (source) {
          if (splitPool) exitPlan.current.toward.set(id, tabCenter(source.type === 'deck' ? 'sideboard' : 'mainboard'));
          markPlaced(id);
          togglePoolCard(source);
        }
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
      // On a phone the pick moves to its stack under the pack, so show its board.
      if (compact && poolTab !== 'mainboard') showBoard('mainboard');
      revealId.current = id;
      markPlaced(id);
      onPick(packIndex);
    }
  };

  // Phones: a pool card held in place grows until the finger lifts.
  const peek = (id: number) => {
    if (!splitPool || !poolIds.has(id) || packIdSet.has(id)) return false;
    hideCard();
    setPeeked(id);
    return true;
  };

  // ---- Pool taps ----
  // A tap sends a card to the other board, in its natural spot.
  const togglePoolCard = (source: DraftLocation) => {
    if (locked) return;
    const id = (source.type === 'deck' ? mainboard : sideboard)[source.row]?.[source.col]?.[source.index];
    if (id === undefined || !cards[id]) return;
    onMovePoolCard(source, naturalLocation(id, source.type === 'deck' ? 'sideboard' : 'deck'));
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
  const mainCount = columnCounts.slice(0, MAIN_COLUMNS).reduce((sum, count) => sum + count, 0);
  const sideCount = columnCounts[SIDEBOARD_COLUMN] ?? 0;
  const poolTarget = drag?.target?.kind === 'pool' ? drag.target : null;
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
    // Phones with the pool on the table draw its cards smaller, in a row that scrolls sideways.
    const inSplitPool = !inPackZone && splitPool !== null;
    sprites.push(
      <CardSprite
        key={`card-${id}`}
        id={id}
        card={card}
        width={inSplitPool ? splitPool.cardW : geometry!.cardW}
        height={inSplitPool ? splitPool.cardH : geometry!.cardH}
        pose={placement.pose}
        z={placement.z}
        zone={placement.zone}
        scroll={inPackZone && compact ? packScroll : null}
        scrollX={inSplitPool ? poolScrollX : null}
        instant={pinching !== null}
        // Desktop: a card lifted by a hover goes back behind its neighbors as soon as it's let go.
        snapStacking={!compact}
        // On a phone, pack cards scrolled out of the pack's part are cut off at its edges: at the
        // bottom, the pool's top edge, so they pass under its pull tab.
        clip={inPackZone && compact ? { top: 0, bottom: splitPool ? splitPool.top : geometry!.height } : null}
        landing={
          placement.zone === 'pool' ? { top: splitPool ? splitPool.top : geometry!.poolTop, bottom: Infinity } : null
        }
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
          // Under a grown card on a phone, at its own size, clear of the rules text. Desktop
          // rows have no room below a card, so there it sits on the card.
          <div
            className={`pointer-events-none absolute left-1/2 whitespace-nowrap ${compact ? 'top-full flex' : 'bottom-1'}`}
            style={{
              // The gap under the card goes inside the counter-scaling, so it stays 4px on screen.
              transform: `translateX(-50%) scale(${1 / geometry!.focus})${compact ? ' translateY(4px)' : ''}`,
              transformOrigin: compact ? '50% 0' : '50% 100%',
            }}
          >
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
  const layoutToggle = (
    <div
      className="flex shrink-0 rounded-md border border-border overflow-hidden"
      role="group"
      aria-label="Pack layout"
    >
      {(
        [
          ['fan', 'Fanned', VersionsIcon],
          ['grid', 'Grid', AppsIcon],
        ] as const
      ).map(([layout, label, Icon]) => (
        <button
          key={layout}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={packLayout === layout}
          onClick={() => setPackLayout(layout)}
          className={`px-2 py-1.5 transition-colors ${
            packLayout === layout ? 'bg-bg-active text-text' : 'text-text-secondary hover:text-text'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
  return (
    // At least one viewport tall (less the phone's bottom nav) regardless of the
    // header above it: scroll past the header and the table fills the screen. On
    // desktop it grows past that with the pool. In the phone layout it's exactly
    // the screen, edge to edge, over the page's side padding: the screen with the
    // browser's bars showing (svh), so it doesn't resize and reshuffle the cards
    // as they slide away and back while the page scrolls.
    <div ref={roomRef}>
      <div
        ref={tableRef}
        className={`relative mt-3 flex flex-col bg-bg-accent/80 shadow overflow-hidden ${
          compact ? '-mx-2 border-y border-border' : 'mx-2 rounded-md border border-border'
        }`}
        style={
          compact
            ? { height: 'calc(100svh - var(--bottom-nav-height, 0px))', minHeight: 480 }
            : { minHeight: 'calc(100dvh - var(--bottom-nav-height, 0px))' }
        }
      >
        {compact ? (
          // The menu drops over the table rather than pushing it down, so the cards keep their size.
          <div ref={headerRef} className="relative z-10 border-b border-border">
            {/* A fixed height, so the cards don't resize when the waiting line comes and goes. */}
            <div className="flex items-center gap-2 h-11 px-2">
              {hasMenu && (
                <PhoneMenuButton open={menuOpen} onToggle={() => setMenuOpen((open) => !open)} label="Draft options" />
              )}
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
                <button
                  type="button"
                  onClick={fitToScreen}
                  aria-label="Fit table to screen"
                  title="Fit table to screen"
                  className="shrink-0 p-1 text-text-secondary hover:text-text"
                >
                  <ScreenFullIcon size={20} />
                </button>
              </div>
            </div>
            {error && <div className="px-2 pb-2">{retryButton}</div>}
            {hasMenu && (
              <div className="absolute inset-x-0 top-full bg-bg-accent shadow-lg">
                <PhoneMenuPanel open={menuOpen}>
                  <div className="flex flex-col items-start gap-3 py-2 px-2 border-b border-border">
                    {menuActions}
                    {ratingsLink}
                  </div>
                </PhoneMenuPanel>
              </div>
            )}
          </div>
        ) : (
          // A fixed height, so the cards don't resize as the buttons and the waiting line come and go.
          <div ref={headerRef} className="flex items-center gap-4 h-12 px-4 border-b border-border">
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
              {layoutToggle}
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

        {/* isolate: the cards' z-indexes stay inside the stage, under the menu and the pool drawer.
            A swipe down its empty spots scrolls the page natively (the cards keep their own touches),
            unless a pinch has made the phone's pack scroll, when it scrolls that instead. */}
        <div
          ref={stageRef}
          className="relative flex-1 overflow-hidden select-none isolate"
          style={{ touchAction: packMax > 0 ? 'none' : 'pan-y', minHeight: compact ? undefined : poolContentBottom }}
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
                  className="absolute text-center text-xs text-text-secondary leading-[22px] pointer-events-none"
                  style={{ left: x - 4, width: geometry.cardW + 8, top: geometry.poolTop }}
                >
                  {COLUMN_LABELS[column]}
                  {columnCounts[column] > 0 && <span className="opacity-60"> · {columnCounts[column]}</span>}
                </div>
              ))}
              {/* Drop highlights: one per stack (column and band). */}
              {poolBands.map(({ column, band, top, height }) => (
                <div
                  key={`${column}-${band}`}
                  className={`absolute rounded-md pointer-events-none transition-colors duration-150 ${
                    poolTarget?.column === column && poolTarget.band === band
                      ? 'bg-button-primary/15'
                      : 'bg-transparent'
                  }`}
                  style={{
                    left: geometry.columnX[column] - 4,
                    width: geometry.cardW + 8,
                    top: top - 4,
                    height: height + 8,
                  }}
                />
              ))}
            </>
          )}
          {splitPool && (
            // Phones with the pool on the table: its tabs, then a row of stacks that scrolls sideways.
            <>
              {/* The pool's top edge stops either side of its pull tab, so the tab joins the panel. */}
              <div
                className="absolute inset-x-0 bottom-0 bg-bg/60 pointer-events-none transition-[top] duration-300 ease-out"
                style={{ top: splitPool.top }}
              >
                <div
                  className="absolute top-0 left-0 h-px bg-border"
                  style={{ right: `calc(50% + ${SPLIT_HANDLE_WIDTH / 2 - 1}px)` }}
                />
                <div
                  className="absolute top-0 right-0 h-px bg-border"
                  style={{ left: `calc(50% + ${SPLIT_HANDLE_WIDTH / 2 - 1}px)` }}
                />
              </div>
              <div
                className="absolute inset-x-0 transition-[top] duration-300 ease-out"
                style={{ top: splitPool.top, zIndex: 700 }}
              >
                <button
                  type="button"
                  onClick={() => setPoolExpanded((expanded) => !expanded)}
                  aria-expanded={poolExpanded}
                  aria-label={poolExpanded ? 'Collapse pool' : 'Expand pool'}
                  title={poolExpanded ? 'Collapse pool' : 'Expand pool'}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 flex items-center justify-center overflow-hidden rounded-t-md border border-b-0 border-border bg-bg text-text-secondary hover:text-text"
                  style={{ width: SPLIT_HANDLE_WIDTH, height: SPLIT_HANDLE_HEIGHT }}
                >
                  {/* Solid, so pack cards scroll under it, in the panel's color: the table's tint and the panel's over the page. */}
                  <span className="absolute inset-0 bg-bg-accent/80" />
                  <span className="absolute inset-0 bg-bg/60" />
                  <span className="relative flex">
                    {poolExpanded ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
                  </span>
                </button>
                <div role="tablist" className="flex" style={{ height: SPLIT_TABS_HEIGHT }}>
                  {poolTabs.map((key) => {
                    const [label, total] =
                      key === 'mainboard'
                        ? ['Mainboard', mainCount]
                        : key === 'sideboard'
                          ? ['Sideboard', sideCount]
                          : ['Removed', removed.length];
                    // A card held over the tab drops into that board.
                    const target =
                      drag?.target?.kind === 'board' && drag.target.board === (key === 'mainboard' ? 'deck' : key);
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={poolTab === key}
                        onClick={() => showBoard(key)}
                        className={`flex-1 text-sm font-semibold border-b-2 transition-colors ${
                          poolTab === key ? 'border-link text-text' : 'border-transparent text-text-secondary'
                        } ${target ? 'bg-button-primary/20 text-text' : ''}`}
                      >
                        {label} · {total}
                      </button>
                    );
                  })}
                </div>
              </div>
              <motion.div
                className="absolute left-0 pointer-events-none transition-[top] duration-300 ease-out"
                style={{ x: poolShift, top: splitPool.labelTop, bottom: 0, width: splitPool.contentWidth }}
              >
                {splitStacks.map((stack, column) => (
                  <div
                    key={column}
                    className={`absolute rounded-md transition-colors duration-150 ${
                      poolTarget?.column === column ? 'bg-button-primary/15' : 'bg-transparent'
                    }`}
                    style={{
                      left: splitPool.columnX[column] - 3,
                      width: splitPool.cardW + 6,
                      top: 0,
                      bottom: SPLIT_SCROLLBAR_HEIGHT,
                    }}
                  >
                    {poolTab !== 'removed' && (
                      <div
                        className="text-center text-xxs text-text-secondary"
                        style={{ lineHeight: `${SPLIT_LABEL_HEIGHT}px` }}
                      >
                        {COLUMN_LABELS[column]}
                        {stack.length > 0 && <span className="opacity-60"> · {stack.length}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
              {/* Zoomed in past fitting, the pack scrolls down from here (a swipe on it picks up a card). */}
              {packMax > 0 && geometry && (
                <Scrollbar
                  axis="y"
                  scroll={packScroll}
                  max={packMax}
                  view={geometry.height}
                  content={geometry.contentHeight}
                  className="absolute right-0 top-0 flex justify-center py-2"
                  style={{ width: PACK_SCROLLBAR_WIDTH, height: geometry.height, zIndex: 700 }}
                />
              )}
              {/* The cards scrolled out of view, counted at the edge they're past; under a card grown to be read. */}
              {packMax > 0 && geometry && (
                <HiddenCards
                  scroll={packScroll}
                  max={packMax}
                  view={geometry.height}
                  tops={packTops}
                  cardHeight={geometry.cardH}
                  topInset={packTag ? 24 : 0}
                  className="absolute inset-x-0 top-0 pointer-events-none"
                  style={{ height: geometry.height, zIndex: 550 }}
                />
              )}
              {/* A swipe on the row picks up a card, so it scrolls from here. */}
              {maxPoolScrollX > 0 && (
                <Scrollbar
                  scroll={poolScrollX}
                  max={maxPoolScrollX}
                  view={stageSize.width}
                  content={splitPool.contentWidth}
                  className="absolute inset-x-0 bottom-0 flex flex-col justify-center px-3"
                  style={{ height: SPLIT_SCROLLBAR_HEIGHT, zIndex: 700 }}
                />
              )}
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
            </>
          )}
        </div>

        {effects}
      </div>
    </div>
  );
};

export default DraftTable;
