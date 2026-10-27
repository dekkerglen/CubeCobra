import { cubeDao, draftDao } from 'dynamo/daos';
import { resolveBotDeckStatus } from 'serverutils/botDeckStatus';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

const handler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    // The deckbuilder is an owner-only editor. Anyone else — logged-out visitors,
    // crawlers, shared/bookmarked links, or a different user — is sent to the public
    // read-only deck view instead of a raw JSON 401 (which rendered as a JSON page and
    // flooded the logs with 401s on /draft/deckbuilder/:id).
    const deckOwnerId = typeof deck.owner !== 'string' ? deck.owner?.id : deck.owner;
    if (!req.user || deckOwnerId !== req.user.id) {
      return redirect(req, res, `/cube/deck/${req.params.id}`);
    }

    const cube = await cubeDao.getById(deck.cube);
    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = getBaseUrl();
    // Resolve the bot-deck build state so a build that died without reporting back renders as
    // failed instead of a banner that spins forever.
    const botDeckStatus = resolveBotDeckStatus(deck);
    return render(
      req,
      res,
      'CubeDeckbuilderPage',
      {
        cube,
        initialDeck: { ...deck, botDecksPending: botDeckStatus.pending, botDecksFailed: botDeckStatus.failed },
      },
      {
        title: `${abbreviate(cube.name)} - Deckbuilder`,
        metadata: generateMeta(cube.brief, cube.image.uri, `${baseUrl}/draft/deckbuilder/${req.params.id}`),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [handler],
  },
];
