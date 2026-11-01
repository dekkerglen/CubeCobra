/**
 * Pure geometry for the draft table. Every card on the table is
 * positioned from these numbers (in stage pixels), so the pack fan, the pool
 * stacks, and the drag hit-testing can never disagree with each other.
 *
 * The stage is split in two: the pack on top, the pool below. The pool is a
 * single band of CMC columns (0..6, 7+) followed by one sideboard column. The
 * pack is a fan, or overlapping rows when that doesn't make the cards much
 * smaller (the pool's columns usually cap the card size first).
 *
 * Phones show only the pack, as rows of small fans spread across the stage (the pool is in a tray).
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
// A fan or row splays its cards: neighbors tilt a SPLAY apart at most, the
// outermost cards a TILT at most, and a card tilted a whole TILT dips an ARC.
const ARC = 0.1;
const TILT = 7;
const FAN_SPLAY = 2.5;
const FAN_SPACING = 0.78; // fraction of a card width between fan neighbors, at most
const BAR = 0.112; // visible slice of each card in a pool stack (the name bar)
const MIN_VISIBLE_BARS = 7; // the card size leaves room for this many bars per stack before the pool scrolls
const MIN_CARD_WIDTH = 56;
// Phones: the pack in rows, each a small fan like the desktop one, running
// edge to edge and spread out to fill the stage. Cards are small enough that a
// row of four barely overlaps, so every card can be read; the room across is
// the scarcer, so rows get fewer cards when the stage is tall enough.
const ROW_PAD = 3; // px above and below the rows
const ROW_MAX = 5; // cards per row, at most...
const ROW_MIN = 3; // ...and at least
const ROW_MAX_ROWS = 5; // rows, at most, unless a full ROW_MAX a row still needs more
const ROW_MIN_SIZE = 0.8; // fewer cards per row win unless they'd make cards smaller than this fraction of the biggest
const ROW_CARD_WIDTH = 0.265; // fraction of the stage width, at most
const ROW_MAX_GAP = 0.5; // fraction of a card width between cards or rows, at most, so a small pack doesn't fly apart
const ROW_GAP = 4; // px between rows, below the outer cards' dip, at least
const ROW_ARC = 0.05;
const ROW_TILT = 5;
const ROW_SPLAY = 2.5;
const ROW_RAISE = 0.08;
const ROW_PEEK = 0.03;
const MIN_ROW_CARD_WIDTH = 40;
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
const DESK_POOL_MIN_BARS = 4; // the pool shows a card and this many name bars before it scrolls
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
  // tilt apart (degrees), and how far a card tilted all the way dips (px).
  arc: number;
  tilt: number;
  splay: number;
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

// The tilt of the outermost of `count` splayed cards.
const edgeTilt = (count: number, tilt: number, splay: number) => Math.min(tilt, ((count - 1) / 2) * splay);

// Tilts for `count` splayed cards, left to right: evenly apart, `splay` degrees at most, and `tilt` at most at the ends.
const splayTilts = (count: number, tilt: number, splay: number): number[] => {
  const half = (count - 1) / 2;
  const step = half > 0 ? edgeTilt(count, tilt, splay) / half : 0;
  return Array.from({ length: count }, (_, i) => (i - half) * step);
};

// How far a splayed card dips: with the square of its tilt, `arc` when it tilts the whole `tilt`.
const tiltDip = (rotate: number, tilt: number, arc: number) => arc * (rotate / tilt) ** 2;

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

// The pack in DESK_ROWS rows over the pool, which shows less before it scrolls.
const computeDeskRowsGeometry = (width: number, height: number, capacity: number): TableGeometry => {
  const rowCount = DESK_ROWS;
  const perRow = Math.ceil(capacity / rowCount);
  const reach = 2 * DESK_TILT_REACH * CARD_ASPECT;
  // A full row fits across with the cards overlapping by half at most.
  const fromRow = (width - 2 * PAD) / (1 + (perRow - 1) * 0.5 + reach);
  // The overlapping rows, then the pool's label, a card and its name bars.
  const fixedHeight = PAD + 8 + 4 + LABEL_HEIGHT + PAD;
  const perCard =
    CARD_ASPECT *
      (DESK_ROW_RAISE + (rowCount - 1) * DESK_ROW_PITCH + 1 + DESK_ROW_ARC + 1 + DESK_POOL_MIN_BARS * BAR) +
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
 * Desktop: the pack in one fan, or in two overlapping rows when it has more
 * than 8 cards and that doesn't cost much card size, so no card is mostly hidden. Rows are sized for the largest pack
 * (`capacity`) so the layout holds steady as the pack shrinks.
 */
export const computeGeometry = (width: number, height: number, capacity: number): TableGeometry => {
  const fan = computeFanGeometry(width, height);
  if (capacity <= DESK_FAN_MAX) return fan;
  const rows = computeDeskRowsGeometry(width, height, capacity);
  return rows.cardW >= fan.cardW * DESK_ROWS_MIN_SIZE ? rows : fan;
};

// A phone row of `perRow` cards: how far its end cards dip (a fraction of the
// card height), and how far their outer lower corners hang below that (of the card width).
const rowSag = (perRow: number) => {
  const tilt = edgeTilt(perRow, ROW_TILT, ROW_SPLAY);
  return { dip: tiltDip(tilt, ROW_TILT, ROW_ARC), hang: Math.sin((tilt * Math.PI) / 180) / 2 };
};

// The widest phone card that `rowCount` rows of `perRow` leave room for down, up to ROW_CARD_WIDTH of the stage across.
const rowCardWidth = (width: number, height: number, rowCount: number, perRow: number) => {
  const { dip, hang } = rowSag(perRow);
  const availableH = height - 2 * ROW_PAD;
  // Each row is a card plus the end cards' dip and lower corners; the top row also needs room to lift.
  const perCardHeight = CARD_ASPECT * (rowCount * (1 + dip) + ROW_RAISE) + rowCount * hang;
  const fromHeight = (availableH - (rowCount - 1) * ROW_GAP) / perCardHeight;
  return Math.max(MIN_ROW_CARD_WIDTH, Math.floor(Math.min(width * ROW_CARD_WIDTH, fromHeight)));
};

/**
 * The phone layout: just the pack, in rows of ROW_MIN to ROW_MAX cards, each
 * row a small fan whose end cards reach the edges of the stage. Cards are as
 * big as the rows allow down, up to ROW_CARD_WIDTH of the stage across, and
 * rows take the fewest cards that doesn't make them much smaller or need more
 * than ROW_MAX_ROWS rows (15 cards are usually 5 rows of 3, 16 are 4 of 4).
 * Laid out for a pack of `count` cards, however big it started; the rows spread
 * across whatever room is left. The pool's tab sits over the right edge.
 */
export const computeRowsGeometry = (width: number, height: number, count: number): TableGeometry => {
  const cards = Math.max(1, count);
  const options: { rowCount: number; cardW: number }[] = [];
  for (let perRow = Math.min(ROW_MAX, cards); perRow >= Math.min(ROW_MIN, cards); perRow -= 1) {
    const rowCount = Math.ceil(cards / perRow);
    if (options.length > 0 && rowCount > ROW_MAX_ROWS) break;
    if (options.length === 0 || options[options.length - 1].rowCount !== rowCount) {
      options.push({ rowCount, cardW: rowCardWidth(width, height, rowCount, Math.ceil(cards / rowCount)) });
    }
  }
  const biggest = Math.max(...options.map((option) => option.cardW));
  const { rowCount, cardW } = options.filter((option) => option.cardW >= biggest * ROW_MIN_SIZE).pop()!;
  const perRow = Math.ceil(cards / rowCount);
  const cardH = Math.round(cardW * CARD_ASPECT);
  const maxGap = cardW * ROW_MAX_GAP;

  const raise = cardH * ROW_RAISE;
  const top = ROW_PAD + raise;
  const roomHeight = height - ROW_PAD - top;
  const { dip, hang } = rowSag(perRow);
  const rowHeight = cardH * (1 + dip) + cardW * hang;

  return {
    width,
    height,
    rows: {
      max: perRow,
      centerX: width / 2,
      width,
      top,
      height: roomHeight,
      rowHeight,
      pitch: rowHeight + maxGap,
      spacing: cardW + maxGap,
      arc: cardH * ROW_ARC,
      tilt: ROW_TILT,
      splay: ROW_SPLAY,
    },
    packCenterX: width / 2,
    packCenterY: top + roomHeight / 2,
    cardW,
    cardH,
    raise,
    peek: cardH * ROW_PEEK,
    fanTop: top,
    packBottom: height,
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
