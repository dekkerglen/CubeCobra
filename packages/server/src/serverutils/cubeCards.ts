import { CubeCards } from '@utils/datatypes/Cube';
import { changelogDao, cubeDao } from 'dynamo/daos';
import { reconstructCubeAtChangelog } from 'serverutils/cubefn';

export interface ResolvedCubeCards {
  cards: CubeCards;
  changelog?: { id: string; date: number };
}

/**
 * Resolves cube cards, optionally at a point in time.
 * When dateMs is provided, reconstructs the cube state at the nearest changelog at or before that date.
 * Returns the cards and optional changelog metadata for the resolved snapshot.
 */
export async function resolveCubeCards(cubeId: string, dateMs?: number): Promise<ResolvedCubeCards> {
  let cards = await cubeDao.getCards(cubeId);

  if (dateMs === undefined) {
    return { cards };
  }

  const changelog = await changelogDao.getNearest(cubeId, dateMs);
  if (!changelog) {
    return { cards };
  }

  cards = await reconstructCubeAtChangelog(cubeId, changelog.date, cards, changelogDao);
  return { cards, changelog: { id: changelog.id, date: changelog.date } };
}

/**
 * Parses a date query parameter string into milliseconds.
 * Returns undefined if param is absent, or NaN if invalid.
 */
export function parseDateParam(dateParam: string | undefined): number | undefined {
  if (!dateParam) return undefined;
  return parseInt(dateParam, 10);
}
