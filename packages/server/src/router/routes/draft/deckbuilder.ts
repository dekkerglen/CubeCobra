import { cubeDao, draftDao } from 'dynamo/daos';
import { resolveBotDeckStatus } from 'serverutils/botDeckStatus';
import { addBasics, getMissingDraftBasics } from 'serverutils/cube';
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

    let deck = await draftDao.getById(req.params.id);
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

    // Basics are snapshotted when a draft is created, so a deck uploaded before the cube had a
    // Basics board (or before it had cards) has none forever. Fill them in from the cube now.
    if (deck.basics.length === 0 && deck.basicsBoard !== 'None') {
      try {
        const cubeCards = await cubeDao.getCards(cube.id);
        const basicCards = getMissingDraftBasics(cubeCards, {
          draftBasicsBoard: deck.basicsBoard,
          cubeBasicsBoard: cube.basicsBoard,
          legacyBasics: cube.basics,
        });
        if (basicCards.length > 0) {
          const poolSize = deck.cards.length;
          const doc = { cards: [...deck.cards], basics: [] as number[] };
          addBasics(doc, basicCards);
          if (await draftDao.backfillBasics(deck.id, poolSize, doc.cards.slice(poolSize))) {
            deck = (await draftDao.getById(deck.id)) ?? deck;
          }
        }
      } catch (err) {
        // Missing basics shouldn't block the deckbuilder; the modal explains the empty state.
        req.logger.error('Failed to backfill draft basics', err);
      }
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
