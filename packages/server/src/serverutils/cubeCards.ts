import { CubeCards } from '@utils/datatypes/Cube';
import { changelogDao, cubeDao } from 'dynamo/daos';
import { reconstructCubeAtChangelog } from 'serverutils/cubefn';

export interface ResolvedCubeCards {
  cards: CubeCards;
  changelog?: { id: string; date: number };
}

export interface PointInTime {
  dateMs?: number;
  changelogId?: string;
}

/**
 * Resolves cube cards, optionally at a point in time.
 * A changelogId takes precedence over dateMs; dateMs resolves to the nearest changelog at or before that date.
 * Returns undefined if changelogId does not exist on this cube.
 */
export async function resolveCubeCards(
  cubeId: string,
  { dateMs, changelogId }: PointInTime = {},
): Promise<ResolvedCubeCards | undefined> {
  let cards = await cubeDao.getCards(cubeId);

  let changelog;
  if (changelogId) {
    changelog = await changelogDao.getById(changelogId);
    if (!changelog || changelog.cube !== cubeId) {
      return undefined;
    }
  } else if (dateMs !== undefined) {
    changelog = await changelogDao.getNearest(cubeId, dateMs);
  }

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
