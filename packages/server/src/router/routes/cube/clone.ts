import Cube from 'dynamo/models/cube';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../types/express';

export const cloneHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      req.flash('danger', 'Please log on to clone this cube.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    const source = await Cube.getById(req.params.id!);
    if (!isCubeViewable(source, req.user) || !source) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }

    const sourceCards = await Cube.getCards(source.id);

    const cube = {
      id: uuidv4(),
      shortId: null,
      name: `Clone of ${source.name}`,
      owner: req.user.id,
      imageName: source.imageName,
      description: `Cloned from [${source.name}](/c/${source.id})\n\n${source.description}`,
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBILITY.PUBLIC,
      featured: false,
      tagColors: source.tagColors,
      defaultFormat: source.defaultFormat,
      numDecks: 0,
      defaultSorts: source.defaultSorts,
      showUnsorted: source.showUnsorted,
      collapseDuplicateCards: source.collapseDuplicateCards,
      formats: source.formats,
      following: [],
      defaultStatus: source.defaultStatus,
      defaultPrinting: source.defaultPrinting,
      disableAlerts: false,
      basics: source.basics,
      tags: source.tags,
      cardCount: source.cardCount,
    };

    const id = await Cube.putNewCube(cube);

    await Cube.putCards({
      ...sourceCards,
      id: cube.id,
    });

    if (!source.disableAlerts && source.owner) {
      await addNotification(
        source.owner,
        req.user,
        `/cube/view/${id}`,
        `${req.user.username} made a cube by cloning yours: ${cube.name}`,
      );
    }

    req.flash('success', 'Cube Cloned');
    return redirect(req, res, `/cube/overview/${cube.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${encodeURIComponent(req.params.id!)}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [cloneHandler],
  },
];
