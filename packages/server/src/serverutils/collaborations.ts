import Cube from '@utils/datatypes/Cube';
import { collaboratorIndexDao, cubeDao } from 'dynamo/daos';

import { isCubeListed, isCubeViewable } from './cubefn';

export const COLLABORATIONS_PAGE_SIZE = 36;

export interface CollaborationsPage {
  cubes: Cube[];
  nextOffset: number;
  hasMore: boolean;
}

/**
 * Page through the cubes a user collaborates on.
 *
 * The collaborator index stores ids only, so paging is offset-based over that list rather than
 * cursor-based like the owned-cube query. Visibility is filtered after the fetch, which means a
 * page of ids can yield nothing the viewer may see; keep consuming pages until one does, or the
 * list runs out, so the caller never receives an empty page while `hasMore` is still true.
 */
export const getCollaborationsPage = async (
  profileUserId: string,
  viewer: { id: string } | undefined,
  offset = 0,
): Promise<CollaborationsPage> => {
  const cubeIds = await collaboratorIndexDao.getCubeIdsForUser(profileUserId);

  // The profile's owner sees every collaboration they can actually open, including unlisted and
  // private ones; isCubeListed has no collaborator branch and would hide those from them.
  const isOwnProfile = viewer?.id === profileUserId;
  const canSee = (cube: Cube) => (isOwnProfile ? isCubeViewable(cube, viewer) : isCubeListed(cube, viewer));

  let cursor = Math.max(0, offset);
  let cubes: Cube[] = [];

  while (cubes.length === 0 && cursor < cubeIds.length) {
    const page = cubeIds.slice(cursor, cursor + COLLABORATIONS_PAGE_SIZE);
    cursor += COLLABORATIONS_PAGE_SIZE;
    cubes = (await cubeDao.batchGet(page)).filter(canSee);
  }

  return { cubes, nextOffset: cursor, hasMore: cursor < cubeIds.length };
};
