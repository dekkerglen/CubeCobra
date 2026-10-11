import Cube from '@utils/datatypes/Cube';
import { PrimerTab, slugifyTabTitle, validatePrimerTabs } from '@utils/primerTabs';
import { cubeDao } from 'dynamo/daos';
import { csrfProtection, ensureAuth } from 'router/middleware';
import { getCubeId, isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

// DynamoDB's item limit is 400 KB; leave headroom for key attributes and GSI fields.
const MAX_CUBE_ITEM_BYTES = 350_000;

const estimateItemBytes = (cube: Cube): number =>
  Buffer.byteLength(JSON.stringify({ ...cube, owner: cube.owner?.id, image: undefined }), 'utf8');

export const editPrimerHandler = async (req: Request, res: Response) => {
  try {
    const { cubeId, primerTabs, tags, activeTab } = req.body;

    const cube = await cubeDao.getById(cubeId);
    const { user } = req;

    if (!cube || !isCubeViewable(cube, user)) {
      res.status(404).json({ error: 'Cube not found' });
      return;
    }

    if (!isCubeEditable(cube, user)) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // if this cube has no cards, we deny them from making any changes
    // this is a spam prevention measure
    if (cube.cardCount === 0) {
      res
        .status(400)
        .json({ error: 'Cannot update the cube primer for an empty cube. Please add cards to the cube first.' });
      return;
    }

    const primerError = validatePrimerTabs(primerTabs);
    if (primerError) {
      res.status(400).json({ error: primerError });
      return;
    }
    cube.primerTabs = primerTabs.map(({ title, content }: PrimerTab) => ({ title, content }));

    // Update tags
    if (tags !== undefined && tags !== null) {
      cube.tags = tags.filter((tag: string) => tag && tag.length > 0).map((tag: string) => tag.toLowerCase());
    }

    cube.date = Date.now().valueOf();

    if (estimateItemBytes(cube) > MAX_CUBE_ITEM_BYTES) {
      const primerIsCause = estimateItemBytes({ ...cube, primerTabs: [] }) <= MAX_CUBE_ITEM_BYTES;
      res.status(400).json({
        error: primerIsCause
          ? 'This cube is too large to save. Try shortening the primer, especially tabs with non-Latin text.'
          : "This cube's other settings (draft formats, views, custom sorts) are too large to save. Contact support for help.",
      });
      return;
    }

    await cubeDao.update(cube);

    let redirect = `/cube/about/${getCubeId(cube)}?view=primer`;
    const activeTabTitle = Number.isInteger(activeTab) && activeTab > 0 ? cube.primerTabs[activeTab]?.title : undefined;
    if (activeTabTitle !== undefined) {
      redirect += `&tab=${encodeURIComponent(slugifyTabTitle(activeTabTitle))}`;
    }

    res.status(200).json({ success: 'Primer updated successfully', redirect });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    res.status(500).json({ error: 'Error updating primer' });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [ensureAuth, csrfProtection, editPrimerHandler],
  },
];
