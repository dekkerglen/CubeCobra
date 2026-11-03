import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { makeSubtitle } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';

import AutocardContext from '../../../contexts/AutocardContext';
import DisplayContext from '../../../contexts/DisplayContext';
import TagColorContext from '../../../contexts/TagColorContext';
import UserContext from '../../../contexts/UserContext';
import DraftLocation from '../../../drafting/DraftLocation';
import useLocalStorage from '../../../hooks/useLocalStorage';
import Text from '../../base/Text';
import CardSprite, { Band, SpriteId } from './CardSprite';
import {
  bandAt,
  bandTops,
  BoardKey,
  computeDeckGeometry,
  deckColumnAt,
  DeckGeometry,
  deckInsertIndex,
  isCompactWidth,
  LABEL_HEIGHT,
  MAX_ZOOM,
  MIN_COLUMNS,
  MIN_ZOOM,
  removedPose,
  rowHeight,
  stackPose,
} from './deckLayout';
import { PhoneMenuButton, PhoneMenuPanel } from './PhoneMenu';
import Scrollbar from './Scrollbar';
import { Pose } from './tableLayout';
import { DragSession, HorizontalScroll, useCardDrag, useClampScroll, useWheelScroll } from './useCardDrag';

type Zone = BoardKey | 'removed';

interface DeckTableProps {
  // All cards in the pool; every other prop refers to cards by their index in here.
  cards: CardType[];
  mainboard: number[][][];
  sideboard: number[][][];
  removed: number[];
  deckTitle: string;
  onDeckTitleChange: (title: string) => void;
  deckNamePlaceholder: string;
  previewImage: string;
  // The deckbuilder's own toolbar, drawn inside the table so it counts toward the
  // window height: as a bar on desktop. On phones the Save button stays in the
  // header and everything else is a list behind a menu button.
  renderToolbar?: (layout: 'bar' | 'list' | 'save') => React.ReactNode;
  // Move a card within or between the deck and sideboard. target.index assumes the
  // card has already been taken out of its pile.
  onMove: (source: DraftLocation, target: DraftLocation) => void;
  onRemove: (source: DraftLocation) => void;
  onRestore: (pileIndex: number, target: DraftLocation) => void;
  // A tap: send the card to the other board, in its natural spot.
  onToggleBoard: (source: DraftLocation) => void;
  onSetArt: (cardIndex: number) => void;
  // What draft-matters cards noted during the draft, by card index.
  notes?: Record<number, string[]>;
}

// Where the card behind one sprite is stored.
interface Slot {
  zone: Zone;
  row: number;
  col: number;
  index: number;
  cardIndex: number;
}

type DropTarget =
  | { kind: 'board'; board: BoardKey; row: number; col: number; index: number }
  | { kind: 'removed' }
  | { kind: 'art' }
  | null;

interface Placement {
  pose: Pose;
  z: number;
  zone: Zone;
}

const BOARDS: BoardKey[] = ['deck', 'sideboard'];
// px of sideways scroll over which an edge fade comes in.
const FADE_RAMP = 24;

const sameTarget = (a: DropTarget, b: DropTarget): boolean => {
  if (a === null || b === null) return a === b;
  if (a.kind === 'board' && b.kind === 'board') {
    return a.board === b.board && a.row === b.row && a.col === b.col && a.index === b.index;
  }
  return a.kind === b.kind;
};

const locationOf = (slot: Slot): DraftLocation =>
  slot.zone === 'deck'
    ? DraftLocation.deck(slot.row, slot.col, slot.index)
    : DraftLocation.sideboard(slot.row, slot.col, slot.index);

/**
 * The deckbuilder as a table: the deck on top, the sideboard below (sharing
 * columns, so a card dragged straight down stays in its column), and a rail with
 * the deck-art target and the removed pile. On phones the removed pile is a
 * strip under the sideboard, the table scrolls sideways, and a pinch sizes the
 * cards. Cards are sprites on one stage with the same drag-and-ease behavior as
 * the draft table; the boards grow to hold their cards and the page scrolls.
 *
 * Deck rules stay in the page; the table only decides where cards are drawn and
 * translates drops and taps into the page's handlers.
 */
const DeckTable: React.FC<DeckTableProps> = ({
  cards,
  mainboard,
  sideboard,
  removed,
  deckTitle,
  onDeckTitleChange,
  deckNamePlaceholder,
  previewImage,
  renderToolbar,
  onMove,
  onRemove,
  onRestore,
  onToggleBoard,
  onSetArt,
  notes = {},
}) => {
  const { showCard, hideCard } = useContext(AutocardContext);
  const { showCustomImages } = useContext(DisplayContext);
  const tagColors = useContext(TagColorContext);
  // The player turned animations off: a held card doesn't lean as it moves.
  const animationsOff = useContext(UserContext)?.disableAnimations ?? false;

  const tableRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  // Desktop: the window's room for the stage, which sizes the cards.
  const [viewRoom, setViewRoom] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => {
      setStageSize({ width: el.clientWidth, height: el.clientHeight });
      // The window less any bar fixed over its bottom (see CubeBottomNav), what's above the stage, and the border.
      const covered =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height')) || 0;
      const above = el.getBoundingClientRect().top - (tableRef.current?.getBoundingClientRect().top ?? 0);
      setViewRoom(window.innerHeight - covered - above - 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const compact = stageSize.width > 0 && isCompactWidth(stageSize.width);
  // Phones: the cards' size, as a pinch has left it (kept for next time), or as a pinch has it right now.
  const [zoom, setZoom] = useLocalStorage<number>('deckbuilderZoom', 1);
  const [pinchZoom, setPinchZoom] = useState<number | null>(null);

  // The handlers are defined further down; these wrappers only run on pointer events.
  const dragger = useCardDrag<DropTarget>({
    stageRef,
    locate: (id) => locate(String(id)),
    target: (session, left, top) => computeTarget(session, left, top),
    sameTarget,
    drop: (session, target) => drop(session, target),
    click: (id) => click(String(id)),
    dragStarted: () => hideCard(),
    horizontal: () => horizontal,
    verticalScroller: () => window,
    // Phones: a touch picks a card up straight away; the sticky scrollbar does the sideways panning.
    touchPicksUp: compact,
    lean: !animationsOff,
  });
  const { drag } = dragger;

  // Sprites are keyed by card index plus occurrence, since added basics share a card index.
  const { slots, stacks, removedKeys } = useMemo(() => {
    const slotMap = new Map<string, Slot>();
    const occurrences = new Map<number, number>();
    const keyFor = (cardIndex: number) => {
      const n = occurrences.get(cardIndex) ?? 0;
      occurrences.set(cardIndex, n + 1);
      return `${cardIndex}#${n}`;
    };
    const boardKeys = (board: number[][][], zone: BoardKey) =>
      board.map((row, r) =>
        row.map((pile, c) =>
          pile.map((cardIndex, index) => {
            const key = keyFor(cardIndex);
            slotMap.set(key, { zone, row: r, col: c, index, cardIndex });
            return key;
          }),
        ),
      );
    const boardStacks: Record<BoardKey, string[][][]> = {
      deck: boardKeys(mainboard, 'deck'),
      sideboard: boardKeys(sideboard, 'sideboard'),
    };
    const pileKeys = removed.map((cardIndex, index) => {
      const key = keyFor(cardIndex);
      slotMap.set(key, { zone: 'removed', row: 0, col: 0, index, cardIndex });
      return key;
    });
    return { slots: slotMap, stacks: boardStacks, removedKeys: pileKeys };
  }, [mainboard, sideboard, removed]);

  // A board with no rows still gets one band to drop into.
  const rowsOf = (board: BoardKey): string[][][] => (stacks[board].length > 0 ? stacks[board] : [[]]);

  // The tallest stack in each row of a board, leaving out one card and/or making room for one.
  const tallestPerRow = (board: BoardKey, without: string | null, gap: DropTarget) =>
    rowsOf(board).map((row, r) =>
      Math.max(
        0,
        ...row.map(
          (pile, c) =>
            pile.filter((key) => key !== without).length +
            (gap?.kind === 'board' && gap.board === board && gap.row === r && gap.col === c ? 1 : 0),
        ),
      ),
    );

  // The boards grow to fit their cards (including the gap a dragged card opens).
  const gapTarget = drag?.target ?? null;
  const deckRows = tallestPerRow('deck', null, gapTarget);
  const sideboardRows = tallestPerRow('sideboard', null, gapTarget);
  const rowsKey = `${deckRows.join(',')}|${sideboardRows.join(',')}`;

  const columnCount = Math.max(MIN_COLUMNS, ...BOARDS.flatMap((board) => stacks[board].map((row) => row.length)));
  const removedCount = removedKeys.length + (gapTarget?.kind === 'removed' ? 1 : 0);
  const cardZoom = pinchZoom ?? zoom;
  // The stage is sized to the cards.
  const geometry: DeckGeometry | null = useMemo(
    () =>
      stageSize.width > 0 && (compact || viewRoom > 0)
        ? computeDeckGeometry(
            stageSize.width,
            stageSize.height,
            viewRoom,
            columnCount,
            removedCount,
            { deck: deckRows, sideboard: sideboardRows },
            cardZoom,
          )
        : null,
    // deckRows/sideboardRows are captured by rowsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stageSize.width, stageSize.height, viewRoom, compact, columnCount, removedCount, rowsKey, cardZoom],
  );

  const scrollX = useMotionValue(0);
  const contentShift = useTransform(scrollX, (value) => -value);
  // Fades at the left and right edges while there's more of the table that way.
  const leftFade = useTransform(scrollX, (value) => Math.min(1, value / FADE_RAMP));
  const rightFade = useMotionValue(0);
  // A card travelling in from another zone stays on top until it's inside the zone's panel.
  const landingOf = (zone: Zone): Band | null =>
    geometry ? { top: geometry[zone].viewTop, bottom: geometry[zone].bottom } : null;

  // ---- Where every card sits this render ----
  const placements = useMemo(() => {
    const result = new Map<string, Placement>();
    if (!geometry) return result;
    const draggedKey = drag ? String(drag.id) : null;
    const target = drag?.target ?? null;

    BOARDS.forEach((board) => {
      const tops = bandTops(geometry, geometry[board], tallestPerRow(board, draggedKey, target));
      rowsOf(board).forEach((row, r) =>
        row.forEach((pile, c) => {
          const gapAt =
            target?.kind === 'board' && target.board === board && target.row === r && target.col === c
              ? target.index
              : -1;
          let index = 0;
          pile
            .filter((key) => key !== draggedKey)
            .forEach((key) => {
              if (index === gapAt) index += 1;
              result.set(key, {
                pose: stackPose(geometry, geometry.columnX[c], tops[r], index),
                z: 10 + index,
                zone: board,
              });
              index += 1;
            });
        }),
      );
    });

    removedKeys
      .filter((key) => key !== draggedKey)
      .forEach((key, index) => result.set(key, { pose: removedPose(geometry, index), z: 10 + index, zone: 'removed' }));

    // The dragged card keeps its home placement, so an illegal drop eases it back there.
    const home = draggedKey ? slots.get(draggedKey) : undefined;
    if (draggedKey && home) {
      if (home.zone === 'removed') {
        result.set(draggedKey, { pose: removedPose(geometry, home.index), z: 10 + home.index, zone: 'removed' });
      } else {
        const tops = bandTops(geometry, geometry[home.zone], tallestPerRow(home.zone, null, null));
        result.set(draggedKey, {
          pose: stackPose(geometry, geometry.columnX[home.col], tops[home.row], home.index),
          z: 10 + home.index,
          zone: home.zone,
        });
      }
    }
    return result;
    // rowsOf/tallestPerRow only read stacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, stacks, removedKeys, slots, drag]);

  // ---- Scrolling ----
  // Only sideways, on phones, when the columns are wider than the screen; the page does the rest.
  const maxScrollX = geometry ? Math.max(0, Math.ceil(geometry.contentWidth - geometry.width)) : 0;
  useClampScroll(scrollX, maxScrollX);
  useEffect(() => {
    const update = (value: number) => rightFade.set(Math.min(1, Math.max(0, maxScrollX - value) / FADE_RAMP));
    update(scrollX.get());
    return scrollX.on('change', update);
  }, [scrollX, maxScrollX, rightFade]);

  const horizontal: HorizontalScroll | null = maxScrollX > 0 ? { scroll: scrollX, max: maxScrollX } : null;
  useWheelScroll(stageRef, [], dragger.scrolled, horizontal, dragger.scrolledX);

  // Between the last column and the rail, in content coordinates (no rail on phones).
  const railEdge = geometry
    ? geometry.compact
      ? Infinity
      : (geometry.columnX[geometry.columns - 1] + geometry.cardW + geometry.railX) / 2
    : 0;

  // ---- Pinching (phones) ----
  // Two fingers size the cards, keeping what's between them under them. The
  // layout follows the fingers as they move, and the size sticks when they lift.
  const pinch = useRef<{
    spread: number;
    zoom: number;
    cardW: number;
    // The point between the fingers, in the table's content coordinates, and the stage's top on the page.
    x: number;
    y: number;
    pageTop: number;
    // Where the fingers are now, on screen.
    midX: number;
    midY: number;
  } | null>(null);
  const pinchState = useRef({ zoom: cardZoom, cardW: geometry?.cardW ?? 0, cancel: dragger.cancel, setZoom });
  useLayoutEffect(() => {
    pinchState.current = { zoom: cardZoom, cardW: geometry?.cardW ?? 0, cancel: dragger.cancel, setZoom };
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
      if (event.touches.length !== 2) return;
      pinchState.current.cancel();
      const rect = stage.getBoundingClientRect();
      const mid = middle(event.touches);
      pinch.current = {
        spread: spread(event.touches),
        zoom: pinchState.current.zoom,
        cardW: pinchState.current.cardW,
        x: mid.x - rect.left + scrollX.get(),
        y: mid.y - rect.top,
        pageTop: rect.top + window.scrollY,
        midX: mid.x,
        midY: mid.y,
      };
      setPinchZoom(pinchState.current.zoom);
    };
    const move = (event: TouchEvent) => {
      const p = pinch.current;
      if (!p || event.touches.length !== 2) return;
      event.preventDefault();
      const mid = middle(event.touches);
      p.midX = mid.x;
      p.midY = mid.y;
      setPinchZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (p.zoom * spread(event.touches)) / p.spread)));
    };
    const end = (event: TouchEvent) => {
      if (!pinch.current || event.touches.length >= 2) return;
      pinch.current = null;
      setPinchZoom((current) => {
        if (current !== null) pinchState.current.setZoom(current);
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
  }, [compact, scrollX]);
  // Once the cards have resized, scroll so the point that was between the fingers still is.
  useLayoutEffect(() => {
    const p = pinch.current;
    const stage = stageRef.current;
    if (!p || !geometry || !stage || p.cardW <= 0) return;
    const scale = geometry.cardW / p.cardW;
    const left = stage.getBoundingClientRect().left;
    scrollX.set(Math.max(0, Math.min(maxScrollX, p.x * scale - (p.midX - left))));
    window.scrollTo({ top: p.pageTop + p.y * scale - p.midY });
  }, [geometry, maxScrollX, scrollX]);

  // ---- Drag and tap ----
  const locate = (key: string) => {
    const slot = slots.get(key);
    return slot ? { zone: slot.zone, scroll: null } : null;
  };

  // left/top are where the card is drawn; columns and the rail are in content coordinates.
  const computeTarget = (s: DragSession, left: number, top: number): DropTarget => {
    if (!geometry) return null;
    const contentLeft = left + scrollX.get();
    const centerX = contentLeft + geometry.cardW / 2;
    // Small targets (the rail's) and the choice of region go by where the card is
    // held: a stacked card is usually grabbed by its name bar, well above its center.
    const pointerX = contentLeft + s.grabX;
    const pointerY = top + s.grabY;

    if (geometry.compact ? pointerY >= geometry.removed.top - 5 : pointerX >= railEdge) {
      if (!geometry.compact && pointerY < geometry.removed.top) return { kind: 'art' };
      return s.zone === 'removed' ? null : { kind: 'removed' };
    }

    const board: BoardKey = pointerY < geometry.sideboard.top - 5 ? 'deck' : 'sideboard';
    const col = deckColumnAt(geometry, centerX);
    if (col === null) return null;
    const draggedKey = String(s.id);
    const tops = bandTops(geometry, geometry[board], tallestPerRow(board, draggedKey, null));
    const row = bandAt(geometry, tops, top);
    const count = (rowsOf(board)[row]?.[col] ?? []).filter((key) => key !== draggedKey).length;
    return { kind: 'board', board, row, col, index: deckInsertIndex(geometry, tops[row], top, count) };
  };

  const drop = (s: DragSession, target: DropTarget) => {
    const slot = slots.get(String(s.id));
    if (!target || !slot) return;

    if (target.kind === 'art') {
      onSetArt(slot.cardIndex);
      return;
    }
    if (target.kind === 'removed') {
      if (slot.zone !== 'removed') onRemove(locationOf(slot));
      return;
    }

    const to =
      target.board === 'deck'
        ? DraftLocation.deck(target.row, target.col, target.index)
        : DraftLocation.sideboard(target.row, target.col, target.index);
    if (slot.zone === 'removed') {
      onRestore(slot.index, to);
      return;
    }
    const from = locationOf(slot);
    const unchanged = from.type === to.type && from.row === to.row && from.col === to.col && from.index === to.index;
    if (!unchanged) onMove(from, to);
  };

  const click = (key: string) => {
    const slot = slots.get(key);
    if (!slot || slot.zone === 'removed') return;
    hideCard();
    onToggleBoard(locationOf(slot));
  };

  const onHoverChange = (id: SpriteId, hovering: boolean) => {
    if (dragger.isDragging()) return;
    const card = cards[slots.get(String(id))?.cardIndex ?? -1];
    if (hovering && card) showCard(card, showCustomImages, tagColors);
    else hideCard();
  };

  // ---- Render ----
  const boardCards = (board: number[][][]) =>
    board
      .flat(2)
      .map((index) => cards[index])
      .filter(Boolean);
  const deckCards = boardCards(mainboard);
  const sideboardCards = boardCards(sideboard);
  const target = drag?.target ?? null;

  // Each row's band in a board as laid out this render, including the gap a dragged card opens.
  const bandsOf = (board: BoardKey) => {
    if (!geometry) return [];
    const rows = tallestPerRow(board, drag ? String(drag.id) : null, target);
    const tops = bandTops(geometry, geometry[board], rows);
    return rows.map((tallest, r) => ({
      top: tops[r],
      height: rowHeight(geometry, tallest),
    }));
  };

  const sprites: React.ReactNode[] = [];
  placements.forEach((placement, key) => {
    const slot = slots.get(key);
    const card = slot ? cards[slot.cardIndex] : undefined;
    if (!card || !geometry) return;
    sprites.push(
      <CardSprite
        key={key}
        id={key}
        card={card}
        width={geometry.cardW}
        height={geometry.cardH}
        pose={placement.pose}
        z={placement.z}
        zone={placement.zone}
        scroll={null}
        scrollX={scrollX}
        clip={null}
        landing={landingOf(placement.zone)}
        enterFrom={{ ...placement.pose, opacity: 0, delay: 0 }}
        dragged={drag?.id === key}
        touchAction="none"
        instant={pinchZoom !== null}
        highlight={null}
        register={dragger.register}
        onPointerDown={dragger.pointerDown}
        onHoverChange={onHoverChange}
      >
        {notes[slot!.cardIndex] && (
          // On the name bar, so it shows on a stacked card too.
          <div
            className="pointer-events-none absolute top-0.5 right-0.5 px-1.5 rounded-full bg-black/80 text-white text-xxs leading-4 truncate"
            style={{ maxWidth: '50%' }}
          >
            {notes[slot!.cardIndex]!.join(' · ')}
          </div>
        )}
      </CardSprite>,
    );
  });

  const regionLabel = (zone: Zone, label: string) => {
    if (!geometry) return null;
    const region = geometry[zone];
    return (
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: geometry.gutterX,
          top: region.top,
          width: geometry.gutterWidth,
          height: region.bottom - region.top,
        }}
      >
        <span
          className="text-xxs uppercase tracking-widest text-text-secondary whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {label}
        </span>
      </div>
    );
  };

  const columnsLeft = geometry ? geometry.columnX[0] - geometry.inset : 0;
  const columnsRight = geometry ? geometry.columnX[geometry.columns - 1] + geometry.cardW + geometry.inset : 0;

  const subtitle = (
    <Text xs className={compact ? 'text-text-secondary' : 'text-text-secondary truncate min-w-0'}>
      {makeSubtitle(deckCards)}
    </Text>
  );
  const phoneMenu = compact && renderToolbar;

  return (
    // On desktop at least one viewport tall (less the phone's bottom nav), toolbar
    // included, regardless of the header above it: scroll past the header and the
    // table fills the screen, and it grows past that with the cards. On phones as
    // tall as its cards. Not clipped, so the toolbar's menus can drop over the stage.
    <div
      ref={tableRef}
      className={`flex flex-col bg-bg-accent/80 shadow border border-border ${
        compact ? 'mt-2 rounded-none border-x-0' : 'mt-3 rounded-md'
      }`}
      style={compact ? undefined : { minHeight: 'calc(100dvh - var(--bottom-nav-height, 0px))' }}
    >
      {renderToolbar && !compact && <div className="pb-2 border-b border-border">{renderToolbar('bar')}</div>}
      <div className={`flex items-center gap-3 min-w-0 ${compact ? 'py-1 px-2' : 'py-2 px-4 border-b border-border'}`}>
        {phoneMenu && (
          <PhoneMenuButton open={menuOpen} onToggle={() => setMenuOpen((open) => !open)} label="Deck tools" />
        )}
        {/* Renaming the deck and picking its art are desktop-only. */}
        {!geometry?.compact && (
          <input
            type="text"
            aria-label="Deck name"
            value={deckTitle}
            onChange={(event) => onDeckTitleChange(event.target.value)}
            placeholder={deckNamePlaceholder}
            maxLength={100}
            className="border border-border rounded px-2 py-1 text-sm w-64 bg-bg focus:outline-none focus:border-link"
          />
        )}
        {/* With the phone menu, the counts get a row of their own below. */}
        {!phoneMenu && subtitle}
        {phoneMenu && <div className="ml-auto shrink-0">{renderToolbar('save')}</div>}
      </div>
      {phoneMenu && (
        <PhoneMenuPanel open={menuOpen}>
          <div className="border-y border-border">{renderToolbar('list')}</div>
        </PhoneMenuPanel>
      )}
      {phoneMenu && <div className="px-2 pb-1">{subtitle}</div>}
      {compact && <div className="border-b border-border" />}

      {/* isolate: the cards' z-indexes stay inside the stage, under the toolbar's menus. */}
      <div
        ref={stageRef}
        className={`relative overflow-hidden select-none isolate rounded-b-md ${compact ? '' : 'flex-1'}`}
        style={
          compact
            ? { height: geometry?.contentHeight ?? 0, touchAction: 'pan-y' }
            : { minHeight: geometry?.contentHeight ?? 0, touchAction: 'none' }
        }
        onPointerDown={dragger.backgroundPointerDown}
      >
        {geometry && (
          <>
            {/* Everything behind the cards, shifted with the sideways scroll. */}
            <motion.div className="absolute inset-0 pointer-events-none" style={{ x: contentShift }}>
              {BOARDS.map((board) => {
                const region = geometry[board];
                return (
                  <div
                    key={board}
                    className="absolute rounded-lg bg-bg/60 border border-border"
                    style={{
                      left: columnsLeft,
                      width: columnsRight - columnsLeft,
                      top: region.top - 4,
                      height: region.bottom - region.top + 8,
                    }}
                  />
                );
              })}
              {regionLabel('deck', `Deck · ${deckCards.length}`)}
              {regionLabel('sideboard', `Sideboard · ${sideboardCards.length}`)}

              {BOARDS.map((board) =>
                geometry.columnX.map((x, col) => {
                  const count = stacks[board].reduce((sum, row) => sum + (row[col]?.length ?? 0), 0);
                  return (
                    <div
                      key={`${board}-${col}`}
                      className="absolute text-center text-xs text-text-secondary"
                      style={{
                        left: x,
                        width: geometry.cardW,
                        top: geometry[board].top,
                        lineHeight: `${LABEL_HEIGHT}px`,
                      }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                }),
              )}

              {/* Drop highlights: one per stack (row and column). */}
              {BOARDS.map((board) =>
                bandsOf(board).map((band, row) =>
                  geometry.columnX.map((x, col) => {
                    const hovered =
                      target?.kind === 'board' && target.board === board && target.row === row && target.col === col;
                    return (
                      <div
                        key={`${board}-${row}-${col}`}
                        className={`absolute rounded-md transition-colors duration-150 ${
                          hovered ? 'bg-button-primary/15' : 'bg-transparent'
                        }`}
                        style={{ left: x - 4, width: geometry.cardW + 8, top: band.top - 4, height: band.height + 8 }}
                      />
                    );
                  }),
                ),
              )}

              {geometry.compact ? (
                // Phones: the removed pile is a strip under the sideboard.
                <div
                  className={`absolute rounded-lg border transition-colors ${
                    target?.kind === 'removed' ? 'border-button-danger bg-button-danger/10' : 'border-border bg-bg/60'
                  }`}
                  style={{
                    left: columnsLeft,
                    width: Math.max(columnsRight, geometry.contentWidth - geometry.inset) - columnsLeft,
                    top: geometry.removed.top - 4,
                    height: geometry.removed.bottom - geometry.removed.top + 8,
                  }}
                >
                  <div className="px-2 text-xs text-text-secondary" style={{ lineHeight: `${LABEL_HEIGHT}px` }}>
                    Removed{removedKeys.length > 0 ? ` · ${removedKeys.length}` : ''}
                  </div>
                </div>
              ) : (
                <>
                  {/* Deck art: drop a card here to use its art as the deck's image. */}
                  <div
                    className="absolute text-xs text-text-secondary"
                    style={{
                      left: geometry.railX,
                      top: geometry.art.top - LABEL_HEIGHT,
                      lineHeight: `${LABEL_HEIGHT}px`,
                    }}
                  >
                    Deck art
                  </div>
                  <div
                    className={`absolute rounded-md overflow-hidden border-2 transition-colors ${
                      target?.kind === 'art' ? 'border-link' : 'border-border'
                    }`}
                    style={{
                      left: geometry.railX,
                      top: geometry.art.top,
                      width: geometry.cardW,
                      height: geometry.art.bottom - geometry.art.top,
                    }}
                    title="Drag a card here to use its art as the deck's image"
                  >
                    <img src={previewImage} alt="Deck art" className="w-full h-full object-cover" />
                  </div>

                  {/* Removed pile: drop a card here to take it out of the deck. */}
                  <div
                    className={`absolute rounded-lg border transition-colors ${
                      target?.kind === 'removed' ? 'border-button-danger bg-button-danger/10' : 'border-border bg-bg/60'
                    }`}
                    style={{
                      left: geometry.railX - 8,
                      width: geometry.cardW + 16,
                      top: geometry.removed.top - 4,
                      height: geometry.removed.bottom - geometry.removed.top + 8,
                    }}
                  >
                    <div
                      className="text-center text-xs text-text-secondary"
                      style={{ lineHeight: `${LABEL_HEIGHT}px` }}
                    >
                      Removed{removedKeys.length > 0 ? ` · ${removedKeys.length}` : ''}
                    </div>
                    {removedKeys.length === 0 && (
                      <div className="px-3 pt-6 text-center text-xs text-text-secondary">
                        Drag a card here to remove it
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>

            <AnimatePresence>{sprites}</AnimatePresence>

            {/* Over resting cards, under a card being dragged or flying across. */}
            {maxScrollX > 0 && (
              <>
                <motion.div
                  className="absolute inset-y-0 left-0 w-8 pointer-events-none bg-gradient-to-r from-bg-accent to-transparent"
                  style={{ opacity: leftFade, zIndex: 2400 }}
                />
                <motion.div
                  className="absolute inset-y-0 right-0 w-8 pointer-events-none bg-gradient-to-l from-bg-accent to-transparent"
                  style={{ opacity: rightFade, zIndex: 2400 }}
                />
              </>
            )}
          </>
        )}
      </div>
      {geometry?.compact && maxScrollX > 0 && (
        // Stuck to the bottom of the screen while the table is in view.
        <Scrollbar
          scroll={scrollX}
          max={maxScrollX}
          view={geometry.width}
          content={geometry.contentWidth}
          className="sticky z-10 px-3 py-3 bg-bg-accent/90 border-t border-border"
          style={{ bottom: 'var(--bottom-nav-height, 0px)' }}
        />
      )}
    </div>
  );
};

export default DeckTable;
