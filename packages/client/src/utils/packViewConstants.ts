/**
 * Pack grid constants — shared sizing for responsive card layouts.
 * Based on the aspect ratio 61/85 for Magic cards and responsive breakpoints.
 */

export const PACK_RESPONSIVE_HEIGHTS = {
  // Mobile: cards at 118px height (responsive based on actual container sizing)
  mobile: 118,
  // Desktop: cards at 208px height (responsive based on actual container sizing)
  desktop: 208,
  // Card aspect ratio: 61/85 = 0.718
  aspectRatio: 61 / 85,
} as const;

export const PACK_GRID = {
  // Gap between cards in pixels
  gap: 8,
  // Minimum height buffer to prevent jank
  minHeightBuffer: 12,
} as const;

export const BREAKPOINTS = {
  // Tailwind breakpoint: md
  md: 768,
} as const;

/**
 * Calculate the appropriate card height for a given viewport width.
 * On mobile (< 768px), uses responsive mobile sizing.
 * On desktop (>= 768px), uses responsive desktop sizing.
 */
export const getPackCardHeight = (width: number): number => {
  return width < BREAKPOINTS.md ? PACK_RESPONSIVE_HEIGHTS.mobile : PACK_RESPONSIVE_HEIGHTS.desktop;
};

/**
 * Calculate the minimum height needed for the pack grid based on card count and column count.
 */
export const getPackMinHeight = (cardCount: number, columns: number, width: number): number => {
  const rows = Math.max(1, Math.ceil(cardCount / columns));
  const cardHeight = getPackCardHeight(width);
  return rows * cardHeight + (rows - 1) * PACK_GRID.gap + PACK_GRID.minHeightBuffer;
};
