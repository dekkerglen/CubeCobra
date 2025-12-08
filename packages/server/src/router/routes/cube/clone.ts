import { cubeDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';
import { addNotification } from 'serverutils/util';
import { getImageData } from 'serverutils/imageutil';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../../types/express';
import { CUBE_VISIBILITY, PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import Cube from '@utils/datatypes/Cube';

export const cloneHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      req.flash('danger', 'Please log on to clone this cube.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    const source = await cubeDao.getById(req.params.id!);
    if (!isCubeViewable(source, req.user) || !source) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }

    const sourceCards = await cubeDao.getCards(source.id);

    const now = Date.now().valueOf();
    const cube: Cube = {
      id: uuidv4(),
      shortId: '',
      name: `Clone of ${source.name}`,
      owner: req.user,
      imageName: source.imageName,
      image: getImageData(source.imageName),
      description: `Cloned from [${source.name}](/c/${source.id})\n\n${source.description}`,
      date: now,
      dateCreated: now,
      dateLastUpdated: now,
      visibility: CUBE_VISIBILITY.PUBLIC,
      priceVisibility: PRICE_VISIBILITY.PUBLIC,
      featured: false,
      categoryOverride: source.categoryOverride,
      categoryPrefixes: source.categoryPrefixes || [],
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
      keywords: source.keywords || [],
      cardCount: source.cardCount,
      version: 1,
    };

    await cubeDao.putNewCube(cube, sourceCards);

    if (!source.disableAlerts && source.owner) {
      await addNotification(
        source.owner,
        req.user,
        `/cube/view/${cube.id}`,
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
