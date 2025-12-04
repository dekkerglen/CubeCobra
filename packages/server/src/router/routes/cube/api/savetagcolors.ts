import Cube from 'dynamo/models/cube';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const savetagcolorsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    if (!req.user || cube.owner.id !== req.user.id) {
      return res.status(401).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    // filter out tags that don't exist on any cards
    const cubeCards = await Cube.getCards(cube.id);
    const tags = new Set<string>();

    for (const [board, list] of Object.entries(cubeCards)) {
      if (board !== 'id') {
        for (const card of list as any[]) {
          for (const tag of card.tags || []) {
            tags.add(tag);
          }
        }
      }
    }

    const allTags = [...tags];

    cube.tagColors = req.body.tag_colors.filter((tagColor: any) => allTags.includes(tagColor.tag));

    await Cube.update(cube);
    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error saving tag colors',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [savetagcolorsHandler],
  },
];
