/**
 * Pure geometry for the draft table. Every card on the table is
 * positioned from these numbers (in stage pixels), so the pack fan, the pool
 * stacks, and the drag hit-testing can never disagree with each other.
 *
 * The stage is split in two: the pack on top, the pool below. The pool is a
 * single band of CMC columns (0..6, 7+) followed by one sideboard column. The
 * pack is a fan, or two rows when that shows every card without making them
 * much smaller (the pool's columns usually cap the card size first).
 *
 * Phones show only the pack, as rows of small fans (the pool is in a tray).
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
const RAISE = 0.2; // how far a selected pack card lifts
const PEEK = 0.09; // how far a hovered pack card lifts
const ARC = 0.1; // how far the outermost fan cards dip
const TILT = 7; // degrees of rotation on the outermost fan cards
const FAN_SPACING = 0.78; // fraction of a card width between fan neighbors, at most
const BAR = 0.112; // visible slice of each card in a pool stack (the name bar)
const MIN_VISIBLE_BARS = 7; // the card size leaves room for this many bars per stack before the pool scrolls
const MIN_CARD_WIDTH = 56;
// Phones: the pack in rows, each a small fan like the desktop one. Room is
// tight, so the padding is minimal and cards overlap as much as it takes to be
// as big as possible.
const ROW_PAD = 3;
const ROW_MAX = 5; // cards per row, at most
const ROW_MIN_SPACING = 0.33; // fraction of a card width between neighbors in a row, at least...
const ROW_MAX_SPACING = 0.8; // ...and at most, so short rows don't spread apart
const ROW_GAP = 4; // px between rows, below the outer cards' dip
const ROW_ARC = 0.05;
const ROW_TILT = 5;
const ROW_RAISE = 0.08;
const ROW_PEEK = 0.03;
const MIN_ROW_CARD_WIDTH = 40;
// How far a tilted end card reaches past its upright box: sideways at the top
// (a fraction of its height), and down at the outer bottom corner (of its width).
const ROW_TILT_REACH = Math.sin((ROW_TILT * Math.PI) / 180);
// Desktop: the pack in rows of up to 8, side by side, over a shorter pool.
const DESK_ROW_MAX = 8;
const DESK_ROW_SPACING = 1.05; // fraction of a card width between neighbors, at most (a small gap)
const DESK_ROW_GAP = 10;
const DESK_ROW_ARC = 0.04;
const DESK_ROW_TILT = 3;
const DESK_ROW_RAISE = 0.08;
const DESK_ROW_PEEK = 0.04;
const DESK_TILT_REACH = Math.sin((DESK_ROW_TILT * Math.PI) / 180);
const DESK_POOL_MIN_BARS = 1; // the pool shows a card and a name bar before it scrolls
// Rows win unless they'd make cards smaller than this fraction of the fan's.
const DESK_ROWS_MIN_SIZE = 0.9;

export interface Pose {
  x: number;
  y: number;
  rotate: number;
}

export interface PackRows {
  // Cards per row, at most.
  max: number;
  // The middle of a row, and the room across for one (tilted end cards included).
  centerX: number;
  width: number;
  // The block of rows the stage was sized for (the largest pack): its top, how
  // many rows, and the distance from one row to the next. A smaller pack's rows
  // sit in the middle of it.
  top: number;
  rowCount: number;
  pitch: number;
  // Between neighbors in a row; rows with more cards than the largest pack's
  // rows squeeze closer so they still fit across.
  spacing: number;
  // The outermost cards' dip (px) and tilt (degrees).
  arc: number;
  tilt: number;
}

export interface TableGeometry {
  width: number;
  height: number;
  // The pack is laid out in rows instead of a fan.
  rows: PackRows | null;
  // The middle of the pack area, where a pack is opened and where it gathers into a pile.
  packCenterX: number;
  packCenterY: number;
  cardW: number;
  cardH: number;
  raise: number;
  peek: number;
  // Top of the center fan card at rest, and the bottom of the pack region.
  fanTop: number;
  packBottom: number;
  // The pool band: labels start at poolTop, stacks at stackTop.
  poolTop: number;
  stackTop: number;
  poolBottom: number;
  bar: number;
  columnX: number[];
}

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
    fanTop,
    packBottom,
    poolTop,
    stackTop,
    poolBottom: height - PAD,
    bar: cardH * BAR,
    columnX: poolColumnX(width, cardW),
  };
};

// The pack in rows of up to DESK_ROW_MAX over the pool, which shows less before it scrolls.
const computeDeskRowsGeometry = (width: number, height: number, capacity: number): TableGeometry => {
  const rowCount = Math.ceil(capacity / DESK_ROW_MAX);
  const perRow = Math.ceil(capacity / rowCount);
  const reach = 2 * DESK_TILT_REACH * CARD_ASPECT;
  // A full row fits across with the cards overlapping by half at most.
  const fromRow = (width - 2 * PAD) / (1 + (perRow - 1) * 0.5 + reach);
  // The rows, then the pool's label, a card and a name bar.
  const fixedHeight = PAD + (rowCount - 1) * DESK_ROW_GAP + 8 + 4 + LABEL_HEIGHT + PAD;
  const perCard =
    CARD_ASPECT * (DESK_ROW_RAISE + rowCount * (1 + DESK_ROW_ARC) + 1 + DESK_POOL_MIN_BARS * BAR) +
    (rowCount * DESK_TILT_REACH) / 2;
  const fromHeight = (height - fixedHeight) / perCard;

  const cardW = Math.max(MIN_CARD_WIDTH, Math.floor(Math.min(poolFromWidth(width), fromRow, fromHeight)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const raise = cardH * DESK_ROW_RAISE;
  const pitch = cardH * (1 + DESK_ROW_ARC) + (cardW * DESK_TILT_REACH) / 2 + DESK_ROW_GAP;
  const blockHeight = rowCount * pitch - DESK_ROW_GAP;
  const top = PAD + raise;
  const rowWidth = width - 2 * PAD;
  const spacing = perRow > 1 ? Math.min(DESK_ROW_SPACING * cardW, (rowWidth - cardW * (1 + reach)) / (perRow - 1)) : 0;
  const packBottom = top + blockHeight + 8;
  const poolTop = packBottom + 4;

  return {
    width,
    height,
    rows: {
      max: DESK_ROW_MAX,
      centerX: width / 2,
      width: rowWidth,
      top,
      rowCount,
      pitch,
      spacing,
      arc: cardH * DESK_ROW_ARC,
      tilt: DESK_ROW_TILT,
    },
    packCenterX: width / 2,
    packCenterY: top + blockHeight / 2,
    cardW,
    cardH,
    raise,
    peek: cardH * DESK_ROW_PEEK,
    fanTop: top,
    packBottom,
    poolTop,
    stackTop: poolTop + LABEL_HEIGHT,
    poolBottom: height - PAD,
    bar: cardH * BAR,
    columnX: poolColumnX(width, cardW),
  };
};

/**
 * Desktop: the pack in one fan, or in rows of up to 8 when that doesn't cost
 * much card size, so every card is in full view. Rows are sized for the largest pack
 * (`capacity`) so the layout holds steady as the pack shrinks.
 */
export const computeGeometry = (width: number, height: number, capacity: number): TableGeometry => {
  const fan = computeFanGeometry(width, height);
  if (capacity <= DESK_ROW_MAX) return fan;
  const rows = computeDeskRowsGeometry(width, height, capacity);
  return rows.cardW >= fan.cardW * DESK_ROWS_MIN_SIZE ? rows : fan;
};

/**
 * The phone layout: just the pack, in rows of at most ROW_MAX overlapping cards,
 * each row a small fan. Cards are as big as fits: as tall as the rows allow, and
 * as wide as the rows allow at the closest overlap; any width left over spreads
 * the cards apart. Sized once for the largest pack (`capacity`) so cards keep
 * their size as the pack shrinks. The pool's tab sits over the right edge.
 */
export const computeRowsGeometry = (width: number, height: number, capacity: number): TableGeometry => {
  const rowCount = Math.max(1, Math.ceil(capacity / ROW_MAX));
  const perRow = Math.ceil(Math.max(1, capacity) / rowCount);
  const availableW = width - 2 * ROW_PAD;
  const availableH = height - 2 * ROW_PAD;
  // Each row is a card plus the end cards' dip and lower corners; the top row also needs room to lift.
  const perCardHeight = CARD_ASPECT * (rowCount * (1 + ROW_ARC) + ROW_RAISE) + (rowCount * ROW_TILT_REACH) / 2;
  const fromHeight = (availableH - (rowCount - 1) * ROW_GAP) / perCardHeight;
  // A full row at the closest overlap, plus the end cards' upper corners.
  const reach = 2 * ROW_TILT_REACH * CARD_ASPECT;
  const fromWidth = availableW / (1 + (perRow - 1) * ROW_MIN_SPACING + reach);
  const cardW = Math.max(MIN_ROW_CARD_WIDTH, Math.floor(Math.min(fromWidth, fromHeight)));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const spacing =
    perRow > 1
      ? Math.max(
          ROW_MIN_SPACING * cardW,
          Math.min(ROW_MAX_SPACING * cardW, (availableW - cardW * (1 + reach)) / (perRow - 1)),
        )
      : 0;

  const raise = cardH * ROW_RAISE;
  const pitch = cardH * (1 + ROW_ARC) + (cardW * ROW_TILT_REACH) / 2 + ROW_GAP;
  const blockHeight = rowCount * pitch - ROW_GAP;
  // Any height left over goes above and below the rows.
  const top = ROW_PAD + raise + Math.max(0, (availableH - raise - blockHeight) / 2);
  const centerX = ROW_PAD + availableW / 2;

  return {
    width,
    height,
    rows: {
      max: ROW_MAX,
      centerX,
      width: availableW,
      top,
      rowCount,
      pitch,
      spacing,
      arc: cardH * ROW_ARC,
      tilt: ROW_TILT,
    },
    packCenterX: centerX,
    packCenterY: top + blockHeight / 2,
    cardW,
    cardH,
    raise,
    peek: cardH * ROW_PEEK,
    fanTop: top,
    packBottom: top + blockHeight + ROW_PAD,
    // No pool on the stage.
    poolTop: height,
    stackTop: height,
    poolBottom: height,
    bar: cardH * BAR,
    columnX: [],
  };
};

/** Resting poses for a fan of `count` cards, left to right. */
export const fanSlots = (g: TableGeometry, count: number): Pose[] => {
  if (count <= 0) return [];
  const half = (count - 1) / 2;
  // Keep the tilted end cards' outer corners inside the stage.
  const usable = g.width - g.cardW - 2 * (PAD + g.cardH * 0.1);
  const spacing = count > 1 ? Math.min(g.cardW * FAN_SPACING, usable / (count - 1)) : 0;
  return Array.from({ length: count }, (_, i) => {
    const t = half === 0 ? 0 : (i - half) / half;
    return {
      x: g.width / 2 + (i - half) * spacing - g.cardW / 2,
      y: g.fanTop + t * t * g.cardH * ARC,
      rotate: t * TILT,
    };
  });
};

/**
 * Resting poses for `count` pack cards: a fan, or rows. Rows share the cards out
 * evenly (11 cards in rows of 5 are rows of 4, 4 and 3), and each curves as if
 * it were a full row, so short rows don't bend more.
 */
export const packSlots = (g: TableGeometry, count: number): Pose[] => {
  const { rows } = g;
  if (!rows) return fanSlots(g, count);
  const rowCount = Math.ceil(count / rows.max);
  const top = rows.top + (Math.max(0, rows.rowCount - rowCount) * rows.pitch) / 2;
  const half = (rows.max - 1) / 2;
  // The tilted end cards' upper corners reach past their upright boxes.
  const reach = 2 * Math.sin((rows.tilt * Math.PI) / 180) * g.cardH;
  const slots: Pose[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const inRow = Math.floor(count / rowCount) + (r < count % rowCount ? 1 : 0);
    const spacing = inRow > 1 ? Math.min(rows.spacing, (rows.width - g.cardW - reach) / (inRow - 1)) : 0;
    for (let i = 0; i < inRow; i += 1) {
      const offset = i - (inRow - 1) / 2;
      const t = offset / half;
      slots.push({
        x: rows.centerX + offset * spacing - g.cardW / 2,
        y: top + r * rows.pitch + t * t * rows.arc,
        rotate: t * rows.tilt,
      });
    }
  }
  return slots;
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

/**
 * Where a card sits in a pool stack, in pool content coordinates: stacks never
 * compress, so a tall stack runs past the bottom and the pool scrolls instead.
 */
export const stackSlot = (g: TableGeometry, column: number, index: number): Pose => ({
  x: g.columnX[column],
  y: g.stackTop + index * g.bar,
  rotate: 0,
});

/** How far the pool can scroll so the tallest stack (of `tallest` cards) is fully visible. */
export const maxPoolScroll = (g: TableGeometry, tallest: number): number => {
  if (tallest <= 0) return 0;
  const contentBottom = g.stackTop + (tallest - 1) * g.bar + g.cardH;
  return Math.max(0, Math.ceil(contentBottom - g.poolBottom));
};

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

/**
 * Where a card whose top edge is at `top` (pool content coordinates) would be
 * inserted into a stack currently holding `count` cards.
 */
export const stackInsertIndex = (g: TableGeometry, top: number, count: number): number =>
  Math.max(0, Math.min(count, Math.round((top - g.stackTop) / g.bar)));
