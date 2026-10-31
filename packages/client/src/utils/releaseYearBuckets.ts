import { cardFirstPrintYear } from '@utils/cardutil';
import type Card from '@utils/datatypes/Card';

// Limited Edition Alpha. Anchoring the axis here keeps the release-year chart comparable between
// cubes instead of rescaling to whatever each cube happens to contain.
export const MAGIC_FIRST_YEAR = 1993;

/**
 * One bucket per year, spanning MAGIC_FIRST_YEAR through `currentYear`. The range only ever widens
 * to fit cards dated outside it, so an outlier moves a bound rather than being clipped. Years with
 * no cards are kept as empty buckets, both to preserve the gaps as information and to keep indices
 * aligned with the chart's labels.
 */
export const releaseYearBuckets = (cards: Card[], currentYear: number): { label: string; cards: Card[] }[] => {
  const dated = cards.filter((card) => cardFirstPrintYear(card) > 0);
  const years = dated.map((card) => cardFirstPrintYear(card));

  const firstYear = Math.min(MAGIC_FIRST_YEAR, ...years);
  const lastYear = Math.max(currentYear, ...years);

  const buckets: { label: string; cards: Card[] }[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    buckets.push({ label: String(year), cards: dated.filter((card) => cardFirstPrintYear(card) === year) });
  }

  return buckets;
};
