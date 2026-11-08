/**
 * Pure geometry for the draft table. Every card on the table is
 * positioned from these numbers (in stage pixels), so the pack, the pool
 * stacks, and the drag hit-testing can never disagree with each other.
 *
 * Desktop: the pack on top, the pool below. The pack is a fan, overlapping
 * rows (when that doesn't make the cards much smaller), or a grid of cards side
 * by side. Cards are sized for the largest pack and the window, so neither the
 * cards nor the pack area change size as the pack shrinks. The pool is two
 * bands of CMC columns (0..6, 7+), creatures over everything else, beside one
 * sideboard column; it grows as tall as its stacks and the page scrolls.
 *
 * Phones show the pack in the top two thirds, as a grid of cards as big as fit
 * (up to a limit), and the pool below, as one row of stacks that scrolls
 * sideways. A tab on the pool pulls it up to take the bottom two thirds instead.
 */

// Height / width of a card image.
export const CARD_ASPECT = 680 / 488;

export const MAIN_COLUMNS = 8;
export const SIDEBOARD_COLUMN = MAIN_COLUMNS;
export const POOL_COLUMNS = MAIN_COLUMNS + 1;
export const COLUMN_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+', 'Side'];

// Tunables. Fractions are of the card height unless noted.
const PAD = 12; // px around the stage edges
const COLUMN_GAP = 10; // px between pool columns
const SIDEBOARD_GAP = 32; // px between the last CMC column and the sideboard
const LABEL_HEIGHT = 22; // px for the column labels above the stacks
const BAND_GAP = 14; // px between the pool's creature and non-creature bands
const RAISE = 0.2; // how far a selected pack card lifts
const PEEK = 0.09; // how far a hovered pack card lifts
// A fan or row splays its cards: neighbors tilt a SPLAY apart at most, the
// outermost cards a TILT at most, and a card tilted a whole TILT dips an ARC.
const ARC = 0.1;
const TILT = 7;
const FAN_SPLAY = 2.5;
const FAN_SPACING = 0.78; // fraction of a card width between fan neighbors, at most
const BAR = 0.112; // visible slice of each card in a pool stack (the name bar)
const MIN_VISIBLE_BARS = 7; // the card size leaves room for this many bars per stack in the window
const MIN_CARD_WIDTH = 56;
// Desktop: a pack of more than 8 cards in two rows, the lower one over the
// text box of the upper, so the pool keeps room to show its stacks.
const DESK_FAN_MAX = 8; // cards in a pack shown as a single fan, at most
const DESK_ROWS = 2;
const DESK_ROW_SPACING = 1.05; // fraction of a card width between neighbors, at most (a small gap)
const DESK_ROW_PITCH = 0.62; // from one row to the next, leaving the name, art and type line of the row above
const DESK_ROW_ARC = 0.04;
const DESK_ROW_TILT = 3;
const DESK_ROW_SPLAY = 0.75;
const DESK_ROW_RAISE = 0.08;
const DESK_ROW_PEEK = 0.04;
const DESK_TILT_REACH = Math.sin((DESK_ROW_TILT * Math.PI) / 180);
const DESK_POOL_MIN_BARS = 4; // the pool shows a card and this many name bars in the window
// Rows win unless they'd make cards smaller than this fraction of the fan's.
const DESK_ROWS_MIN_SIZE = 0.9;
// Desktop grid: the fan's cards side by side, none covering another.
const DESK_GRID_GAP = 10;
// Phones: the pack as a grid of cards as big as the stage allows, so they grow
// as the pack shrinks. A tapped card grows to be read.
const GRID_PAD = 6; // px around the grid
const GRID_GAP = 6; // px between cards, at least
const GRID_MAX_GAP = 0.5; // fraction of a card width between cards or rows, at most, so a small pack doesn't fly apart
const GRID_MAX_COLUMNS = 6;
const GRID_MAX_CARD_WIDTH = 0.4; // fraction of the stage width a card fits to, at most, so the last few cards of a pack aren't huge
const MIN_GRID_CARD_WIDTH = 40;
const FOCUS_WIDTH = 0.72; // a tapped card grows to this fraction of the stage width, or as tall as fits
const FOCUS_LABEL_ROOM = 28; // px kept clear under a grown card for its label
const PEEK_FINGER_ROOM = 20; // px kept clear between a held pool card and the grown one above it, for the fingertip
export const PACK_SCROLLBAR_WIDTH = 14; // px kept on the right for the pack's scrollbar, when it scrolls
// How far a pinch sizes the pack's cards from their best fit, and the pool's from theirs.
export const MIN_PACK_ZOOM = 0.6;
export const MAX_PACK_ZOOM = 2.5;
const MAX_POOL_ZOOM = 2.5;
// Phones, with the pool on the table below the pack.
const SPLIT_PACK_SHARE = 2 / 3; // of the stage height, for the pack
const SPLIT_PACK_SHARE_EXPANDED = 1 / 3; // ...with the pool pulled up
export const SPLIT_HANDLE_HEIGHT = 20; // px for the pool's pull tab, between the pack and the pool
export const SPLIT_HANDLE_WIDTH = 52;
export const SPLIT_TABS_HEIGHT = 34; // px for the pool's tabs
export const SPLIT_LABEL_HEIGHT = 18; // px for the column labels
const SPLIT_PAD = 6;
const SPLIT_GAP = 6; // px between the pool's columns
const SPLIT_CARD_WIDTH = 0.2; // fraction of the stage width a pool card is, at most
export const SPLIT_SCROLLBAR_HEIGHT = 22; // px at the bottom for the row's scrollbar
const MIN_SPLIT_CARD_WIDTH = 28;

export type PackLayout = 'fan' | 'grid';

export interface Pose {
  x: number;
  y: number;
  rotate: number;
  // How much bigger than its size the card is drawn, about its bottom middle (1 when left out).
  scale?: number;
}

export interface PackRows {
  // Cards per row, at most.
  max: number;
  // The middle of a row, and the room across for one (tilted end cards included).
  centerX: number;
  width: number;
  // The room down for the rows: its top and height, and the height of one row
  // (its outer cards' dip included). Rows spread apart to fill it, up to
  // `pitch` from one row to the next (less than a row's height when they
  // overlap), and sit in the middle of it.
  top: number;
  height: number;
  rowHeight: number;
  pitch: number;
  // Between neighbors in a row, at most; rows spread apart to fill the width up
  // to this, and squeeze closer when they have too many cards to fit.
  spacing: number;
  // How the rows splay (see splayTilts): the most a card tilts and neighbors
  // tilt apart (degrees), and how far a card tilted all the way dips (px). All
  // zero for a grid.
  arc: number;
  tilt: number;
  splay: number;
}

export interface TableGeometry {
  width: number;
  height: number;
  // The pack is laid out in rows (or a grid) instead of a fan.
  rows: PackRows | null;
  // The middle of the pack area, where a pack is opened and where it gathers into a pile.
  packCenterX: number;
  packCenterY: number;
  cardW: number;
  cardH: number;
  raise: number;
  peek: number;
  // How much a tapped card grows to be read (phones); 1 where it lifts by `raise` instead.
  focus: number;
  // Top of the center fan card at rest, and the bottom of the pack region.
  fanTop: number;
  packBottom: number;
  // How tall the pack's cards run: past `height` on a phone zoomed in, where the pack scrolls.
  contentHeight: number;
  // The pool: labels start at poolTop, stacks at stackTop.
  poolTop: number;
  stackTop: number;
  bar: number;
  columnX: number[];
}

// The tilt of the outermost of `count` splayed cards.
const edgeTilt = (count: number, tilt: number, splay: number) => Math.min(tilt, ((count - 1) / 2) * splay);

// Tilts for `count` splayed cards, left to right: evenly apart, `splay` degrees at most, and `tilt` at most at the ends.
const splayTilts = (count: number, tilt: number, splay: number): number[] => {
  const half = (count - 1) / 2;
  const step = half > 0 ? edgeTilt(count, tilt, splay) / half : 0;
  return Array.from({ length: count }, (_, i) => (i - half) * step);
};

// How far a splayed card dips: with the square of its tilt, `arc` when it tilts the whole `tilt`.
const tiltDip = (rotate: number, tilt: number, arc: number) => (tilt > 0 ? arc * (rotate / tilt) ** 2 : 0);

// Widest card that fits all pool columns across.
const poolFromWidth = (width: number) =>
  (width - 2 * PAD - (MAIN_COLUMNS - 1) * COLUMN_GAP - SIDEBOARD_GAP) / POOL_COLUMNS;

const poolColumnX = (width: number, cardW: number) => {
  const blockWidth = POOL_COLUMNS * cardW + (MAIN_COLUMNS - 1) * COLUMN_GAP + SIDEBOARD_GAP;
  const left = Math.max(PAD, (width - blockWidth) / 2);
  return Array.from(
    { length: POOL_COLUMNS },
    (_, c) => left + c * (cardW + COLUMN_GAP) + (c === SIDEBOARD_COLUMN ? SIDEBOARD_GAP - COLUMN_GAP : 0),
  );
};

// `height` is the window's room for the table, which only sizes the cards: the
// pool below the pack grows as tall as it needs.
const computeFanGeometry = (width: number, height: number): TableGeometry => {
  const fromWidth = poolFromWidth(width);
  // Tallest card that fits the fan plus a pool stack of MIN_VISIBLE_BARS cards.
  const fixedHeight = PAD + 8 + 4 + LABEL_HEIGHT + PAD;
  const heightInCards = RAISE + 1 + ARC + 1 + MIN_VISIBLE_BARS * BAR;
  const fromHeight = (height - fixedHeight) / heightInCards / CARD_ASPECT;

  const cardW = Math.max(MIN_CARD_WIDTH, Math.floor(Math.min(fromWidth, fromHeight)));
  const cardH = Math.round(cardW * CARD_ASPECT);

  const raise = cardH * RAISE;
  const fanTop = PAD + raise;
  // Tilted cards' outer corners hang below their resting box, so leave room for them.
  const packBottom = fanTop + cardH + cardH * ARC + cardW * 0.1 + 8;
  const poolTop = packBottom + 4;
  const stackTop = poolTop + LABEL_HEIGHT;

  return {
    width,
    height,
    rows: null,
    packCenterX: width / 2,
    packCenterY: fanTop + cardH / 2,
    cardW,
    cardH,
    raise,
    peek: cardH * PEEK,
    focus: 1,
    fanTop,
    packBottom,
    contentHeight: height,
    poolTop,
    stackTop,
    bar: cardH * BAR,
    columnX: poolColumnX(width, cardW),
  };
};

// The pack in DESK_ROWS rows over the pool, which shows less of itself in the window.
const computeDeskRowsGeometry = (width: number, height: number, capacity: number): TableGeometry => {
  const rowCount = DESK_ROWS;
  const perRow = Math.ceil(capacity / rowCount);
  const reach = 2 * DESK_TILT_REACH * CARD_ASPECT;
  // A full row fits across with the cards overlapping by half at most.
  const fromRow = (width - 2 * PAD) / (1 + (perRow - 1) * 0.5 + reach);
  // The overlapping rows, then the pool's label, a card and its name bars.
  const fixedHeight = PAD + 8 + 4 + LABEL_HEIGHT + PAD;
  const perCard =
    CARD_ASPECT * (DESK_ROW_RAISE + (rowCount - 1) * DESK_ROW_PITCH + 1 + DESK_ROW_ARC + 1 + DESK_POOL_MIN_BARS * BAR) +
    DESK_TILT_REACH / 2;
  const fromHeight = (height - fixedHeight) / perCard;

  const cardW = Math.max(MIN_CARD_WIDTH, Math.floor(Math.min(poolFromWidth(width), fromRow, fromHeight)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const raise = cardH * DESK_ROW_RAISE;
  const rowHeight = cardH * (1 + DESK_ROW_ARC) + (cardW * DESK_TILT_REACH) / 2;
  const pitch = cardH * DESK_ROW_PITCH;
  const blockHeight = (rowCount - 1) * pitch + rowHeight;
  const top = PAD + raise;
  const rowWidth = width - 2 * PAD;
  const spacing = perRow > 1 ? Math.min(DESK_ROW_SPACING * cardW, (rowWidth - cardW * (1 + reach)) / (perRow - 1)) : 0;
  const packBottom = top + blockHeight + 8;
  const poolTop = packBottom + 4;

  return {
    width,
    height,
    rows: {
      max: perRow,
      centerX: width / 2,
      width: rowWidth,
      top,
      height: blockHeight,
      rowHeight,
      pitch,
      spacing,
      arc: cardH * DESK_ROW_ARC,
      tilt: DESK_ROW_TILT,
      splay: DESK_ROW_SPLAY,
    },
    packCenterX: width / 2,
    packCenterY: top + blockHeight / 2,
    cardW,
    cardH,
    raise,
    peek: cardH * DESK_ROW_PEEK,
    focus: 1,
    fanTop: top,
    packBottom,
    contentHeight: height,
    poolTop,
    stackTop: poolTop + LABEL_HEIGHT,
    bar: cardH * BAR,
    columnX: poolColumnX(width, cardW),
  };
};

// The pack as a grid of `cardW` cards side by side, as many to a row as fit,
// in as many rows as the largest pack needs.
const computeDeskGridGeometry = (width: number, height: number, capacity: number, cardW: number): TableGeometry => {
  const cardH = Math.round(cardW * CARD_ASPECT);
  const cards = Math.max(1, capacity);
  const rowWidth = width - 2 * PAD;
  const fit = Math.max(1, Math.floor((rowWidth + DESK_GRID_GAP) / (cardW + DESK_GRID_GAP)));
  const rowCount = Math.ceil(cards / fit);
  const raise = cardH * DESK_ROW_RAISE;
  const top = PAD + raise;
  const blockHeight = rowCount * cardH + (rowCount - 1) * DESK_GRID_GAP;
  const packBottom = top + blockHeight + 8;
  const poolTop = packBottom + 4;

  return {
    width,
    height,
    rows: {
      max: Math.ceil(cards / rowCount),
      centerX: width / 2,
      width: rowWidth,
      top,
      height: blockHeight,
      rowHeight: cardH,
      pitch: cardH + DESK_GRID_GAP,
      spacing: cardW + DESK_GRID_GAP,
      arc: 0,
      tilt: 0,
      splay: 0,
    },
    packCenterX: width / 2,
    packCenterY: top + blockHeight / 2,
    cardW,
    cardH,
    raise,
    peek: cardH * DESK_ROW_PEEK,
    focus: 1,
    fanTop: top,
    packBottom,
    contentHeight: height,
    poolTop,
    stackTop: poolTop + LABEL_HEIGHT,
    bar: cardH * BAR,
    columnX: poolColumnX(width, cardW),
  };
};

/**
 * Desktop: the pack in one fan, or in two overlapping rows when it has more
 * than 8 cards and that doesn't cost much card size, so no card is mostly
 * hidden; or, as a `grid`, the same cards side by side. Sized for the largest
 * pack (`capacity`) and the window's room for the table (`height`), so the
 * layout holds steady as the pack shrinks.
 */
export const computeGeometry = (
  width: number,
  height: number,
  capacity: number,
  layout: PackLayout = 'fan',
): TableGeometry => {
  const fan = computeFanGeometry(width, height);
  const rows = capacity > DESK_FAN_MAX ? computeDeskRowsGeometry(width, height, capacity) : null;
  const fanned = rows && rows.cardW >= fan.cardW * DESK_ROWS_MIN_SIZE ? rows : fan;
  return layout === 'grid' ? computeDeskGridGeometry(width, height, capacity, fanned.cardW) : fanned;
};

/**
 * The phone layout: just the pack, as a grid with as many columns as make the
 * cards biggest, so they grow as the pack shrinks. Laid out for a pack of
 * `count` cards, however big it started, though no card fits to more than
 * GRID_MAX_CARD_WIDTH of the stage; the rows spread from top to bottom and a
 * short row sits in the middle. A tapped card grows to FOCUS_WIDTH of the
 * stage so it can be read.
 */
export const computeGridGeometry = (width: number, height: number, count: number, zoom = 1): TableGeometry => {
  const cards = Math.max(1, count);
  const roomW = width - 2 * GRID_PAD;
  const roomH = height - 2 * GRID_PAD;
  let bestColumns = 1;
  let best = 0;
  for (let c = 1; c <= Math.min(cards, GRID_MAX_COLUMNS); c += 1) {
    const rowCount = Math.ceil(cards / c);
    const fit = Math.min(
      (roomW - (c - 1) * GRID_GAP) / c,
      (roomH - (rowCount - 1) * GRID_GAP) / rowCount / CARD_ASPECT,
    );
    if (fit > best) {
      best = fit;
      bestColumns = c;
    }
  }
  best = Math.min(best, width * GRID_MAX_CARD_WIDTH);
  // A pinch sizes the cards from their best fit: zoomed in, fewer fit across and
  // the rows run past the bottom (the pack scrolls); zoomed out, more fit across.
  const cardW = Math.max(MIN_GRID_CARD_WIDTH, Math.floor(Math.min(roomW, best * zoom)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const layOut = (across: number) => {
    const fit = Math.max(1, Math.floor((across + GRID_GAP) / (cardW + GRID_GAP)));
    const columns = Math.min(cards, zoom > 1 ? Math.min(bestColumns, fit) : Math.max(bestColumns, fit));
    const rowCount = Math.ceil(cards / columns);
    return { across, columns, blockHeight: rowCount * cardH + (rowCount - 1) * GRID_GAP };
  };
  // Rows running past the bottom leave room on the right for the scrollbar.
  const full = layOut(roomW);
  const overflows = full.blockHeight > roomH;
  const { across: rowWidth, columns, blockHeight } = overflows ? layOut(roomW - PACK_SCROLLBAR_WIDTH) : full;
  const maxGap = cardW * GRID_MAX_GAP;
  // Every row keeps a full row's spacing, so a short one lines up under the rest.
  const spacing = columns > 1 ? Math.min(cardW + maxGap, (rowWidth - cardW) / (columns - 1)) : 0;
  const focusW = Math.min(width * FOCUS_WIDTH, (roomH - FOCUS_LABEL_ROOM) / CARD_ASPECT);

  return {
    width,
    height,
    rows: {
      max: columns,
      centerX: GRID_PAD + rowWidth / 2,
      width: rowWidth,
      top: GRID_PAD,
      // Rows that run past the bottom sit a gap apart; otherwise they spread out to fill.
      height: overflows ? blockHeight : roomH,
      rowHeight: cardH,
      pitch: cardH + (overflows ? GRID_GAP : maxGap),
      spacing,
      arc: 0,
      tilt: 0,
      splay: 0,
    },
    packCenterX: width / 2,
    packCenterY: height / 2,
    cardW,
    cardH,
    raise: 0,
    peek: 0,
    focus: Math.max(1, focusW / cardW),
    fanTop: GRID_PAD,
    packBottom: height,
    contentHeight: overflows ? blockHeight + 2 * GRID_PAD : height,
    // No pool on the stage.
    poolTop: height,
    stackTop: height,
    bar: cardH * BAR,
    columnX: [],
  };
};

/** Phones with the pool on the table: where the pool's part starts, pulled up (`expanded`) or not. */
export const splitPoolTop = (height: number, expanded: boolean) =>
  Math.round(height * (expanded ? SPLIT_PACK_SHARE_EXPANDED : SPLIT_PACK_SHARE));

/** ...and the height of the pack's part above it, clear of the pool's pull tab. */
export const splitPackHeight = (height: number, expanded: boolean) =>
  splitPoolTop(height, expanded) - SPLIT_HANDLE_HEIGHT;

// Phones with the pool on the table: the pool's part of the stage, below the pack.
export interface SplitPool {
  // The panel's top, where its tabs are; the labels, then the stacks, start below them.
  top: number;
  labelTop: number;
  stackTop: number;
  cardW: number;
  cardH: number;
  bar: number;
  // In the row's own coordinates, which scroll sideways.
  columnX: number[];
  contentWidth: number;
  // How far a pinch has sized the cards from their fit, and how far one can: further
  // either way changes nothing, so a pinch starts from here and stops at the ends.
  zoom: number;
  zoomRange: [number, number];
}

/**
 * The pool under the pack on a phone: `columns` stacks in one row, as wide as
 * SPLIT_CARD_WIDTH of the stage, scrolling sideways when they don't fit across.
 * Cards get smaller when the tallest stack (of `tallest` cards) would run off the
 * bottom, so every name stays in view. A pinch sizes them from there: bigger,
 * short of a stack running off the bottom; smaller, until the whole row fits across.
 */
export const computeSplitPool = (
  width: number,
  height: number,
  columns: number,
  tallest: number,
  expanded: boolean,
  zoom = 1,
): SplitPool => {
  const top = splitPoolTop(height, expanded);
  const labelTop = top + SPLIT_TABS_HEIGHT;
  const stackTop = labelTop + SPLIT_LABEL_HEIGHT;
  const room = height - SPLIT_SCROLLBAR_HEIGHT - stackTop;
  const fromHeight = room / (1 + (Math.max(1, tallest) - 1) * BAR) / CARD_ASPECT;
  const fit = Math.max(MIN_SPLIT_CARD_WIDTH, Math.min(width * SPLIT_CARD_WIDTH, fromHeight));
  const across = Math.max(1, columns);
  const fromWidth = (width - 2 * SPLIT_PAD - (across - 1) * SPLIT_GAP) / across;
  const largest = Math.max(fit, Math.min(fit * MAX_POOL_ZOOM, width * 0.9, fromHeight));
  const smallest = Math.min(fit, Math.max(MIN_SPLIT_CARD_WIDTH, fromWidth));
  const zoomRange: [number, number] = [smallest / fit, largest / fit];
  const shown = Math.max(zoomRange[0], Math.min(zoomRange[1], zoom));
  const cardW = Math.floor(fit * shown);
  const cardH = Math.round(cardW * CARD_ASPECT);
  const columnX = Array.from({ length: columns }, (_, c) => SPLIT_PAD + c * (cardW + SPLIT_GAP));
  const contentWidth = 2 * SPLIT_PAD + columns * cardW + Math.max(0, columns - 1) * SPLIT_GAP;
  return { top, labelTop, stackTop, cardW, cardH, bar: cardH * BAR, columnX, contentWidth, zoom: shown, zoomRange };
};

/** Where a card sits in a stack of the split pool, in the row's coordinates. */
export const splitSlot = (pool: SplitPool, column: number, index: number): Pose => ({
  x: pool.columnX[column],
  y: pool.stackTop + index * pool.bar,
  rotate: 0,
});

/**
 * A pool card held on a phone, grown to be read: as big as a tapped pack card,
 * above where it sits so the finger doesn't cover it (smaller when there isn't
 * room for that), and kept inside the stage. `base` is in the row's
 * coordinates, scrolled sideways `scrollX`; so is the result.
 */
export const peekPose = (pool: SplitPool, width: number, base: Pose, scrollX: number): Pose => {
  const room = base.y - PEEK_FINGER_ROOM - GRID_PAD;
  const w = Math.max(pool.cardW, Math.min(width * FOCUS_WIDTH, room / CARD_ASPECT));
  const h = w * CARD_ASPECT;
  const drawnX = base.x - scrollX;
  const left = Math.max(GRID_PAD, Math.min(width - GRID_PAD - w, drawnX + (pool.cardW - w) / 2));
  const top = Math.max(GRID_PAD, base.y - PEEK_FINGER_ROOM - h);
  // Cards grow about their bottom middle, so put the card where that lands the grown one there.
  return { x: left + (w - pool.cardW) / 2 + scrollX, y: top + h - pool.cardH, rotate: 0, scale: w / pool.cardW };
};

/** The split pool's column under a card centered at `centerX` (the row's coordinates), or null between or outside them. */
export const splitColumnAt = (pool: SplitPool, centerX: number): number | null => {
  let best: number | null = null;
  let bestDistance = pool.cardW * 0.75;
  pool.columnX.forEach((x, c) => {
    const distance = Math.abs(x + pool.cardW / 2 - centerX);
    if (distance < bestDistance) {
      best = c;
      bestDistance = distance;
    }
  });
  return best;
};

/** Resting poses for a fan of `count` cards, left to right. */
export const fanSlots = (g: TableGeometry, count: number): Pose[] => {
  if (count <= 0) return [];
  const half = (count - 1) / 2;
  // Keep the tilted end cards' outer corners inside the stage.
  const usable = g.width - g.cardW - 2 * (PAD + g.cardH * 0.1);
  const spacing = count > 1 ? Math.min(g.cardW * FAN_SPACING, usable / (count - 1)) : 0;
  return splayTilts(count, TILT, FAN_SPLAY).map((rotate, i) => ({
    x: g.width / 2 + (i - half) * spacing - g.cardW / 2,
    y: g.fanTop + tiltDip(rotate, TILT, g.cardH * ARC),
    rotate,
  }));
};

/**
 * Resting poses for `count` pack cards: a fan, or rows. Rows share the cards out
 * evenly (11 cards in rows of 5 are rows of 4, 4 and 3), spread apart to fill
 * the room as far as the geometry allows, and splay like fans, so short rows
 * don't bend more between neighbors.
 */
export const packSlots = (g: TableGeometry, count: number): Pose[] => {
  const { rows } = g;
  if (!rows) return fanSlots(g, count);
  const rowCount = Math.ceil(count / rows.max);
  const pitch = rowCount > 1 ? Math.min(rows.pitch, (rows.height - rows.rowHeight) / (rowCount - 1)) : 0;
  const top = rows.top + (rows.height - (rowCount - 1) * pitch - rows.rowHeight) / 2;
  const slots: Pose[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const inRow = Math.floor(count / rowCount) + (r < count % rowCount ? 1 : 0);
    // The tilted end cards' upper corners reach past their upright boxes.
    const reach = 2 * Math.sin((edgeTilt(inRow, rows.tilt, rows.splay) * Math.PI) / 180) * g.cardH;
    const spacing = inRow > 1 ? Math.min(rows.spacing, (rows.width - g.cardW - reach) / (inRow - 1)) : 0;
    splayTilts(inRow, rows.tilt, rows.splay).forEach((rotate, i) => {
      slots.push({
        x: rows.centerX + (i - (inRow - 1) / 2) * spacing - g.cardW / 2,
        y: top + r * pitch + tiltDip(rotate, rows.tilt, rows.arc),
        rotate,
      });
    });
  }
  return slots;
};

/**
 * A tapped card on a phone, grown to be read: centered on its spot, kept in the
 * part of the pack in view (scrolled down `scrollTop`) with room for its label below.
 */
export const focusPose = (g: TableGeometry, base: Pose, scrollTop = 0): Pose => {
  const scale = g.focus;
  const w = g.cardW * scale;
  const h = g.cardH * scale;
  const left = Math.max(GRID_PAD, Math.min(g.width - GRID_PAD - w, base.x + (g.cardW - w) / 2));
  const top = Math.max(
    scrollTop + GRID_PAD,
    Math.min(scrollTop + g.height - GRID_PAD - FOCUS_LABEL_ROOM - h, base.y + (g.cardH - h) / 2),
  );
  // Cards grow about their bottom middle, so put the card where that lands the grown one there.
  return { x: left + (w - g.cardW) / 2, y: top + h - g.cardH, rotate: 0, scale };
};

/** Which of `count` pack slots is closest to a card centered at (centerX, centerY); a fan only looks across. */
export const nearestPackSlot = (g: TableGeometry, count: number, centerX: number, centerY: number): number => {
  let best = 0;
  let bestDistance = Infinity;
  packSlots(g, count).forEach((slot, i) => {
    const dy = g.rows ? slot.y + g.cardH / 2 - centerY : 0;
    const distance = Math.hypot(slot.x + g.cardW / 2 - centerX, dy);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
};

/** How tall a pool stack of `count` cards is; an empty one still has room for a card to drop into. */
export const poolStackHeight = (g: TableGeometry, count: number) => g.cardH + (Math.max(1, count) - 1) * g.bar;

/**
 * Where the pool's two bands start: the creatures at the top, everything else
 * below the tallest creature stack (of `tallestCreatures` cards).
 */
export const poolBandTops = (g: TableGeometry, tallestCreatures: number): [number, number] => [
  g.stackTop,
  g.stackTop + poolStackHeight(g, tallestCreatures) + BAND_GAP,
];

/**
 * The bottom of the pool's cards: the lower band's tallest stack, or the
 * sideboard's when it runs longer. Stacks never squeeze; the table grows instead.
 */
export const poolBottom = (
  g: TableGeometry,
  bandTops: [number, number],
  tallestOthers: number,
  sideboardCount: number,
): number => Math.max(bandTops[1] + poolStackHeight(g, tallestOthers), g.stackTop + poolStackHeight(g, sideboardCount));

/** Where a card sits in a pool stack: a CMC column has a stack in each band, the sideboard one from the top. */
export const stackSlot = (
  g: TableGeometry,
  bandTops: [number, number],
  column: number,
  band: number,
  index: number,
): Pose => ({
  x: g.columnX[column],
  y: (column === SIDEBOARD_COLUMN ? g.stackTop : bandTops[band]) + index * g.bar,
  rotate: 0,
});

/** Which band of a CMC column a card whose top edge is at `top` belongs to. */
export const poolBandAt = (g: TableGeometry, bandTops: [number, number], top: number): number =>
  top + g.bar * 0.5 >= bandTops[1] ? 1 : 0;

/** Where a pack gathers into a pile before it is passed on or laid out. */
export const gatherPose = (g: TableGeometry): Pose => ({
  x: g.packCenterX - g.cardW / 2,
  y: g.packCenterY - g.cardH / 2,
  rotate: 0,
});

/** The pool column under a card centered at `centerX`, or null when it is between/outside columns. */
export const columnAt = (g: TableGeometry, centerX: number): number | null => {
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

/** Where a card whose top edge is at `top` would be inserted into a stack of `count` cards starting at `stackTop`. */
export const stackInsertIndex = (g: TableGeometry, stackTop: number, top: number, count: number): number =>
  Math.max(0, Math.min(count, Math.round((top - stackTop) / g.bar)));
