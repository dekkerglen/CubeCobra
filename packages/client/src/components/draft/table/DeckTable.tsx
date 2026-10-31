import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { makeSubtitle } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';
import { AnimatePresence, motion, MotionValue, useMotionValue, useTransform } from 'framer-motion';

import AutocardContext from '../../../contexts/AutocardContext';
import DisplayContext from '../../../contexts/DisplayContext';
import TagColorContext from '../../../contexts/TagColorContext';
import DraftLocation from '../../../drafting/DraftLocation';
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
  maxRegionScroll,
  MIN_COLUMNS,
  removedPose,
  rowHeight,
  stackPose,
} from './deckLayout';
import { PhoneMenuButton, PhoneMenuPanel } from './PhoneMenu';
import ScrollThumb from './ScrollThumb';
import { Pose } from './tableLayout';
import {
  DragSession,
  HorizontalScroll,
  revealInView,
  ScrollRegion,
  useCardDrag,
  useClampScroll,
  useWheelScroll,
} from './useCardDrag';

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
 * The deckbuilder as a table that fits the viewport: the deck on top, the
 * sideboard below (sharing columns, so a card dragged straight down stays in its
 * column), and a rail with the deck-art target and the removed pile. On phones
 * the removed pile is a strip under the sideboard and the table scrolls
 * sideways. Cards are sprites on one stage with the same drag-and-ease behavior
 * as the draft table; each region scrolls on its own when it holds more than fits.
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
}) => {
  const { showCard, hideCard } = useContext(AutocardContext);
  const { showCustomImages } = useContext(DisplayContext);
  const tagColors = useContext(TagColorContext);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The handlers are defined further down; these wrappers only run on pointer events.
  const dragger = useCardDrag<DropTarget>({
    stageRef,
    locate: (id) => locate(String(id)),
    target: (session, left, top) => computeTarget(session, left, top),
    sameTarget,
    drop: (session, target) => drop(session, target),
    click: (id) => click(String(id)),
    dragStarted: () => hideCard(),
    scrollRegions: () => scrollRegions,
    horizontal: () => horizontal,
    verticalScroller: () => (geometry?.compact ? window : null),
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

  // On phones the boards grow to fit their cards (including the gap a dragged card opens).
  const gapTarget = drag?.target ?? null;
  const deckRows = tallestPerRow('deck', null, gapTarget);
  const sideboardRows = tallestPerRow('sideboard', null, gapTarget);
  const rowsKey = `${deckRows.join(',')}|${sideboardRows.join(',')}`;

  const compact = stageSize.width > 0 && isCompactWidth(stageSize.width);
  const columnCount = Math.max(MIN_COLUMNS, ...BOARDS.flatMap((board) => stacks[board].map((row) => row.length)));
  // Phones size the stage to the cards.
  const geometry: DeckGeometry | null = useMemo(
    () =>
      stageSize.width > 0 && (compact || stageSize.height > 0)
        ? computeDeckGeometry(stageSize.width, stageSize.height, columnCount, removedKeys.length, {
            deck: deckRows,
            sideboard: sideboardRows,
          })
        : null,
    // deckRows/sideboardRows are captured by rowsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stageSize.width, stageSize.height, compact, columnCount, removedKeys.length, rowsKey],
  );

  const deckScroll = useMotionValue(0);
  const sideboardScroll = useMotionValue(0);
  const removedScroll = useMotionValue(0);
  const scrollX = useMotionValue(0);
  const contentShift = useTransform(scrollX, (value) => -value);
  const deckShift = useTransform(deckScroll, (value) => -value);
  const sideboardShift = useTransform(sideboardScroll, (value) => -value);
  // Fades at the left and right edges while there's more of the table that way.
  const leftFade = useTransform(scrollX, (value) => Math.min(1, value / FADE_RAMP));
  const rightFade = useMotionValue(0);
  const scrollOf = (zone: Zone): MotionValue<number> =>
    zone === 'deck' ? deckScroll : zone === 'sideboard' ? sideboardScroll : removedScroll;
  const viewOf = (zone: Zone): Band | null =>
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
  // Phones normally have no inner vertical scrolling: the boards fit their cards and the page scrolls.
  const deckMax = geometry?.scrollsInside ? maxRegionScroll(geometry, geometry.deck, deckRows) : 0;
  const sideboardMax = geometry?.scrollsInside ? maxRegionScroll(geometry, geometry.sideboard, sideboardRows) : 0;
  // The phone layout's removed strip is a single row; it scrolls sideways with everything else.
  const removedMax =
    geometry && !geometry.compact
      ? maxRegionScroll(geometry, geometry.removed, [removedKeys.length + (gapTarget?.kind === 'removed' ? 1 : 0)])
      : 0;
  const maxOf = (zone: Zone) => (zone === 'deck' ? deckMax : zone === 'sideboard' ? sideboardMax : removedMax);
  const maxScrollX = geometry ? Math.max(0, Math.ceil(geometry.contentWidth - geometry.width)) : 0;
  useClampScroll(deckScroll, deckMax);
  useClampScroll(sideboardScroll, sideboardMax);
  useClampScroll(removedScroll, removedMax);
  useClampScroll(scrollX, maxScrollX);
  useEffect(() => {
    const update = (value: number) => rightFade.set(Math.min(1, Math.max(0, maxScrollX - value) / FADE_RAMP));
    update(scrollX.get());
    return scrollX.on('change', update);
  }, [scrollX, maxScrollX, rightFade]);

  const horizontal: HorizontalScroll | null = maxScrollX > 0 ? { scroll: scrollX, max: maxScrollX } : null;

  // Between the last column and the rail, in content coordinates (no rail on phones).
  const railEdge = geometry
    ? geometry.compact
      ? Infinity
      : (geometry.columnX[geometry.columns - 1] + geometry.cardW + geometry.railX) / 2
    : 0;
  // Scroll regions are on-screen rectangles.
  const scrollRegions: ScrollRegion[] =
    geometry && geometry.scrollsInside
      ? [
          {
            left: 0,
            right: Math.min(railEdge, geometry.width),
            top: geometry.deck.top,
            viewTop: geometry.deck.viewTop,
            bottom: geometry.deck.bottom,
            scroll: deckScroll,
            max: deckMax,
          },
          {
            left: 0,
            right: Math.min(railEdge, geometry.width),
            top: geometry.sideboard.top,
            viewTop: geometry.sideboard.viewTop,
            bottom: geometry.compact ? geometry.sideboard.bottom : geometry.height,
            scroll: sideboardScroll,
            max: sideboardMax,
          },
          {
            left: geometry.compact ? 0 : railEdge,
            right: geometry.width,
            top: geometry.removed.top,
            viewTop: geometry.removed.viewTop,
            bottom: geometry.height,
            scroll: removedScroll,
            max: removedMax,
          },
        ]
      : [];
  useWheelScroll(stageRef, scrollRegions, dragger.scrolled, horizontal, dragger.scrolledX);

  // After a tap moves a card to the other board, scroll it into view there.
  const revealKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = revealKey.current;
    if (key === null || !geometry) return;
    revealKey.current = null;
    const placement = placements.get(key);
    const slot = slots.get(key);
    if (!placement || !slot || slot.zone === 'removed') return;
    const pile = stacks[slot.zone][slot.row]?.[slot.col] ?? [];
    const region = geometry[slot.zone];
    // The last card in a stack shows its whole face, the others just their name bar.
    const top = placement.pose.y;
    const bottom = top + (pile[pile.length - 1] === key ? geometry.cardH : geometry.bar);
    revealInView(scrollOf(slot.zone), top, bottom, region.viewTop, region.bottom, maxOf(slot.zone));
  });

  // ---- Drag and tap ----
  const locate = (key: string) => {
    const slot = slots.get(key);
    return slot ? { zone: slot.zone, scroll: scrollOf(slot.zone) } : null;
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
    const contentTop = top + scrollOf(board).get();
    const tops = bandTops(geometry, geometry[board], tallestPerRow(board, draggedKey, null));
    const row = bandAt(geometry, tops, contentTop);
    const count = (rowsOf(board)[row]?.[col] ?? []).filter((key) => key !== draggedKey).length;
    return { kind: 'board', board, row, col, index: deckInsertIndex(geometry, tops[row], contentTop, count) };
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
    revealKey.current = key;
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
    const view = viewOf(placement.zone);
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
        scroll={scrollOf(placement.zone)}
        scrollX={scrollX}
        clip={view}
        landing={view}
        enterFrom={{ ...placement.pose, opacity: 0, delay: 0 }}
        dragged={drag?.id === key}
        touchAction={geometry.scrollsInside ? 'none' : 'pan-y'}
        highlight={null}
        register={dragger.register}
        onPointerDown={dragger.pointerDown}
        onHoverChange={onHoverChange}
      />,
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
  // Vertical scrollbars sit beside the columns, or at the screen edge when the table scrolls sideways.
  const thumbLeft = geometry ? (geometry.compact ? geometry.width - 8 : columnsRight + 2) : 0;

  const subtitle = (
    <Text xs className={compact ? 'text-text-secondary' : 'text-text-secondary truncate min-w-0'}>
      {makeSubtitle(deckCards)}
    </Text>
  );
  const phoneMenu = compact && renderToolbar;

  return (
    // On desktop exactly one viewport tall (less the phone's bottom nav), toolbar
    // included, regardless of the header above it: scroll past the header and the
    // table fills the screen. On phones as tall as its cards. Not clipped, so the
    // toolbar's menus can drop over the stage.
    <div
      className={`flex flex-col bg-bg-accent/80 shadow border border-border ${
        compact ? 'mt-2 rounded-none border-x-0' : 'mt-3 rounded-md'
      }`}
      style={compact ? undefined : { height: 'calc(100dvh - var(--bottom-nav-height, 0px))', minHeight: 480 }}
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
        className={`relative overflow-hidden select-none isolate rounded-b-md ${compact ? '' : 'flex-1 min-h-0'}`}
        style={compact ? { height: geometry?.contentHeight ?? 0, touchAction: 'pan-y' } : { touchAction: 'none' }}
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

              {/* Drop highlights: one per stack (row and column), scrolling and clipped with the board. */}
              {BOARDS.map((board) => {
                const region = geometry[board];
                const clipTop = region.viewTop - 4;
                return (
                  <div
                    key={`${board}-drop`}
                    className="absolute overflow-hidden"
                    style={{
                      left: 0,
                      width: geometry.contentWidth,
                      top: clipTop,
                      height: region.bottom + 4 - clipTop,
                    }}
                  >
                    <motion.div
                      className="absolute inset-0"
                      style={{ y: board === 'deck' ? deckShift : sideboardShift }}
                    >
                      {bandsOf(board).map((band, row) =>
                        geometry.columnX.map((x, col) => {
                          const hovered =
                            target?.kind === 'board' &&
                            target.board === board &&
                            target.row === row &&
                            target.col === col;
                          return (
                            <div
                              key={`${row}-${col}`}
                              className={`absolute rounded-md transition-colors duration-150 ${
                                hovered ? 'bg-button-primary/15' : 'bg-transparent'
                              }`}
                              style={{
                                left: x - 4,
                                width: geometry.cardW + 8,
                                top: band.top - 4 - clipTop,
                                height: band.height + 8,
                              }}
                            />
                          );
                        }),
                      )}
                    </motion.div>
                  </div>
                );
              })}

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

            <ScrollThumb
              scroll={deckScroll}
              max={deckMax}
              left={thumbLeft}
              top={geometry.deck.viewTop}
              height={geometry.deck.bottom - geometry.deck.viewTop}
            />
            <ScrollThumb
              scroll={sideboardScroll}
              max={sideboardMax}
              left={thumbLeft}
              top={geometry.sideboard.viewTop}
              height={geometry.sideboard.bottom - geometry.sideboard.viewTop}
            />
            <ScrollThumb
              scroll={removedScroll}
              max={removedMax}
              left={Math.min(geometry.width - 8, geometry.railX + geometry.cardW + 10)}
              top={geometry.removed.viewTop}
              height={geometry.removed.bottom - geometry.removed.viewTop}
            />

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
    </div>
  );
};

export default DeckTable;
