/**
 * Pure geometry for the deckbuilder table. The stage is split into the deck
 * (top) and sideboard (bottom), which share the same columns so a card dragged
 * straight down lands in the same column, plus a rail on the right holding the
 * deck-art drop target and the removed pile. Each board's rows are drawn as
 * bands of column stacks one above the other. Nothing scrolls inside the table:
 * each board is as tall as its cards and the page scrolls instead.
 *
 * On narrow (phone) stages there's no rail: the removed pile is a strip under
 * the sideboard, the table scrolls sideways, and a pinch sizes the cards.
 */
import { CARD_ASPECT, Pose } from './tableLayout';

export type BoardKey = 'deck' | 'sideboard';

// Tunables. Fractions are of the card height unless noted.
const PAD = 12;
const GUTTER = 26; // px on the left for the region names
const COLUMN_GAP = 10;
const RAIL_GAP = 24; // px between the last column and the rail
export const LABEL_HEIGHT = 22;
const BAND_GAP = 14; // px between a board's rows
const DIVIDER = 10; // px between the deck and sideboard regions
const BAR = 0.112; // visible slice of each card in a stack (the name bar)
const SIDEBOARD_SHARE = 0.4; // fraction of the window's height that holds a sideboard card and a couple of name bars
const ART_RATIO = 0.62; // deck-art target height / width
export const MIN_COLUMNS = 8;
const MIN_CARD_WIDTH = 56;
// Below this stage width the table uses the phone layout.
const COMPACT_WIDTH = 768;
// Phones are short on room, so everything around the cards is tighter.
const COMPACT_PAD = 6;
const COMPACT_GUTTER = 14;
const COMPACT_COLUMN_GAP = 6;
const COMPACT_BAND_GAP = 8;
const COMPACT_DIVIDER = 6;
const COMPACT_CARD_SHARE = 0.32; // card width as a fraction of the stage width, before any pinch...
const COMPACT_MIN_CARD_WIDTH = 96;
const COMPACT_MAX_CARD_WIDTH = 170;
const ZOOMED_MIN_CARD_WIDTH = 48; // ...and the smallest and largest (of the stage width) a pinch makes them
const ZOOMED_MAX_CARD_SHARE = 0.9;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.5;
const COMPACT_REMOVED_PEEK = 0.3; // how much of each removed card the strip shows

export const isCompactWidth = (width: number) => width < COMPACT_WIDTH;

// A board's region: its label at top, stacks from viewTop, and its panel down to bottom.
export interface Region {
  top: number;
  viewTop: number;
  bottom: number;
}

export interface DeckGeometry {
  width: number;
  height: number;
  // Phone layout: no rail, removed pile in a strip under the sideboard, sideways scrolling.
  compact: boolean;
  // Size of everything on the table: wider than the stage when it scrolls
  // sideways, and the height the stage should be at least.
  contentWidth: number;
  contentHeight: number;
  cardW: number;
  cardH: number;
  bar: number;
  columns: number;
  gutterX: number;
  // Width of the column of region names on the left.
  gutterWidth: number;
  columnX: number[];
  columnGap: number;
  bandGap: number;
  // How far the region panels extend around the cards.
  inset: number;
  railX: number;
  deck: Region;
  sideboard: Region;
  removed: Region;
  art: { top: number; bottom: number };
}

// Height of one row's band, given its tallest stack. Empty rows still get a
// card's height so there's somewhere to drop into.
const bandHeight = (cardH: number, bar: number, tallest: number) => cardH + (Math.max(1, tallest) - 1) * bar;

/** Height of a row's band, given its tallest stack (see bandTops). */
export const rowHeight = (g: DeckGeometry, tallest: number) => bandHeight(g.cardH, g.bar, tallest);

// Height of a board's bands, given the tallest stack in each row (see bandTops).
const bandsHeight = (cardH: number, bar: number, bandGap: number, tallestPerRow: number[]) =>
  tallestPerRow.reduce((sum, tallest) => sum + bandHeight(cardH, bar, tallest), 0) +
  Math.max(0, tallestPerRow.length - 1) * bandGap;

const computeCompactGeometry = (
  width: number,
  columns: number,
  removedCount: number,
  tallest: Record<BoardKey, number[]>,
  zoom: number,
): DeckGeometry => {
  const unzoomed = Math.max(COMPACT_MIN_CARD_WIDTH, Math.min(COMPACT_MAX_CARD_WIDTH, width * COMPACT_CARD_SHARE));
  const cardW = Math.round(Math.max(ZOOMED_MIN_CARD_WIDTH, Math.min(width * ZOOMED_MAX_CARD_SHARE, unzoomed * zoom)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const bar = cardH * BAR;

  const deckBottom = COMPACT_PAD + LABEL_HEIGHT + bandsHeight(cardH, bar, COMPACT_BAND_GAP, tallest.deck) + 4;
  const sideboardTop = deckBottom + COMPACT_DIVIDER;
  const sideboardBottom =
    sideboardTop + LABEL_HEIGHT + bandsHeight(cardH, bar, COMPACT_BAND_GAP, tallest.sideboard) + 4;
  const removedTop = sideboardBottom + COMPACT_DIVIDER;
  const removedBottom = removedTop + LABEL_HEIGHT + cardH * COMPACT_REMOVED_PEEK + 4;

  const columnX = Array.from(
    { length: columns },
    (_, c) => COMPACT_PAD + COMPACT_GUTTER + c * (cardW + COMPACT_COLUMN_GAP),
  );
  const columnsEnd = columnX[columns - 1] + cardW;
  const removedEnd = columnX[0] + removedCount * (cardW + COMPACT_COLUMN_GAP) - COMPACT_COLUMN_GAP;
  const contentWidth = Math.max(columnsEnd, removedEnd) + COMPACT_PAD;
  const contentHeight = removedBottom + COMPACT_PAD;

  return {
    width,
    height: contentHeight,
    compact: true,
    contentWidth,
    contentHeight,
    cardW,
    cardH,
    bar,
    columns,
    gutterX: 0,
    gutterWidth: COMPACT_PAD + COMPACT_GUTTER - 3,
    columnX,
    columnGap: COMPACT_COLUMN_GAP,
    bandGap: COMPACT_BAND_GAP,
    inset: 3,
    railX: contentWidth,
    deck: { top: COMPACT_PAD, viewTop: COMPACT_PAD + LABEL_HEIGHT, bottom: deckBottom },
    sideboard: { top: sideboardTop, viewTop: sideboardTop + LABEL_HEIGHT, bottom: sideboardBottom },
    removed: { top: removedTop, viewTop: removedTop + LABEL_HEIGHT, bottom: removedBottom },
    art: { top: 0, bottom: 0 },
  };
};

/**
 * `tallest` is the tallest stack in each row of each board, which the boards
 * grow to fit. On desktop `viewHeight` is the window's room for the stage,
 * which sizes the cards, and `height` the stage's, which the panels reach down
 * to; phones size cards by the stage width and `zoom` (a pinch).
 */
export const computeDeckGeometry = (
  width: number,
  height: number,
  viewHeight: number,
  columns: number,
  removedCount: number,
  tallest: Record<BoardKey, number[]>,
  zoom = 1,
): DeckGeometry => {
  if (isCompactWidth(width)) return computeCompactGeometry(width, columns, removedCount, tallest, zoom);

  const fromWidth = (width - 2 * PAD - GUTTER - (columns - 1) * COLUMN_GAP - RAIL_GAP) / (columns + 1);
  // The window should show at least a whole sideboard card and a couple of name bars.
  const fromSideboard = (viewHeight * SIDEBOARD_SHARE - LABEL_HEIGHT - PAD) / (1 + 2 * BAR) / CARD_ASPECT;
  // The rail stacks the art target over the removed pile.
  const fromRail = (viewHeight - 2 * PAD - 2 * LABEL_HEIGHT - 12) / (CARD_ASPECT + ART_RATIO);

  const cardW = Math.max(MIN_CARD_WIDTH, Math.floor(Math.min(fromWidth, fromSideboard, fromRail)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const bar = cardH * BAR;

  const blockWidth = GUTTER + columns * cardW + (columns - 1) * COLUMN_GAP + RAIL_GAP + cardW;
  const left = Math.max(PAD, (width - blockWidth) / 2);
  const gutterX = left;
  const columnX = Array.from({ length: columns }, (_, c) => left + GUTTER + c * (cardW + COLUMN_GAP));
  const railX = columnX[columns - 1] + cardW + RAIL_GAP;

  const deckBottom = PAD + LABEL_HEIGHT + bandsHeight(cardH, bar, BAND_GAP, tallest.deck) + 4;
  const sideboardTop = deckBottom + DIVIDER;
  const sideboardEnd = sideboardTop + LABEL_HEIGHT + bandsHeight(cardH, bar, BAND_GAP, tallest.sideboard) + 4;
  const artTop = PAD + LABEL_HEIGHT;
  const artBottom = artTop + cardW * ART_RATIO;
  const removedTop = artBottom + 12;
  const removedEnd = removedTop + LABEL_HEIGHT + bandHeight(cardH, bar, removedCount) + 4;
  const contentHeight = Math.max(sideboardEnd, removedEnd) + PAD;
  // The sideboard and removed panels reach the bottom of the stage.
  const bottom = Math.max(height, contentHeight) - PAD;

  return {
    width,
    height,
    compact: false,
    contentWidth: width,
    contentHeight,
    cardW,
    cardH,
    bar,
    columns,
    gutterX,
    gutterWidth: 20,
    columnX,
    columnGap: COLUMN_GAP,
    bandGap: BAND_GAP,
    inset: 8,
    railX,
    deck: { top: PAD, viewTop: PAD + LABEL_HEIGHT, bottom: deckBottom },
    sideboard: { top: sideboardTop, viewTop: sideboardTop + LABEL_HEIGHT, bottom },
    removed: { top: removedTop, viewTop: removedTop + LABEL_HEIGHT, bottom },
    art: { top: artTop, bottom: artBottom },
  };
};

/**
 * Where each row's band starts, given the tallest stack in each row. Empty rows
 * still get a card's height so there's somewhere to drop into.
 */
export const bandTops = (g: DeckGeometry, region: Region, tallestPerRow: number[]): number[] => {
  const tops: number[] = [];
  let top = region.viewTop;
  tallestPerRow.forEach((tallest) => {
    tops.push(top);
    top += rowHeight(g, tallest) + g.bandGap;
  });
  return tops;
};

/** Where a card sits in the removed pile: a stack in the rail, or a row in the phone layout's strip. */
export const removedPose = (g: DeckGeometry, index: number): Pose =>
  g.compact
    ? { x: g.columnX[0] + index * (g.cardW + g.columnGap), y: g.removed.viewTop, rotate: 0 }
    : { x: g.railX, y: g.removed.viewTop + index * g.bar, rotate: 0 };

export const stackPose = (g: DeckGeometry, x: number, bandTop: number, index: number): Pose => ({
  x,
  y: bandTop + index * g.bar,
  rotate: 0,
});

/** The column under a card centered at `centerX`, or null when it is between/outside columns. */
export const deckColumnAt = (g: DeckGeometry, centerX: number): number | null => {
  let best: number | null = null;
  let bestDistance = g.cardW * 0.75;
  g.columnX.forEach((x, c) => {
    const distance = Math.abs(x + g.cardW / 2 - centerX);
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  });
  return best;
};

/** Which row's band a card whose top edge is at `top` (content coordinates) belongs to. */
export const bandAt = (g: DeckGeometry, tops: number[], top: number): number => {
  let row = 0;
  tops.forEach((bandTop, r) => {
    if (bandTop <= top + g.bar * 0.5) row = r;
  });
  return row;
};

/** Where a card whose top edge is at `top` would be inserted into a stack of `count` starting at `bandTop`. */
export const deckInsertIndex = (g: DeckGeometry, bandTop: number, top: number, count: number): number =>
  Math.max(0, Math.min(count, Math.round((top - bandTop) / g.bar)));
