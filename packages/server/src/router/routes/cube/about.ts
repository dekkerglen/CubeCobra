import { CUBE_VISIBILITY, PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import { blogDao, changelogDao, cubeDao } from 'dynamo/daos';
import { cardFromId, getIdsFromName } from 'serverutils/carddb';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import { isInFeaturedQueue } from 'serverutils/featuredQueue';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const aboutHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await cubeDao.getCards(cube.id);
    const { mainboard } = cards;

    // Fetch blog posts
    const blogs = await blogDao.queryByCube(cube.id, undefined, 20);

    // Fetch changelog
    const changes = await changelogDao.queryByCubeWithData(cube.id, undefined, 36);

    const followersCount = cube.following?.length || 0;

    const isInQueue = await isInFeaturedQueue(cube);

    // calculate cube prices
    const nameToCards: Record<string, any[]> = {};
    for (const card of mainboard) {
      if (card.details && !nameToCards[card.details.name]) {
        const allVersionsOfCard = getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionsOfCard.map((id: string) => cardFromId(id));
      }
    }

    const cheapestDict: Record<string, number> = {};
    for (const card of mainboard) {
      if (card.details) {
        const versions = nameToCards[card.details.name];
        if (!cheapestDict[card.details.name] && versions) {
          for (const version of versions) {
            const currentCheapest = cheapestDict[version.name];
            if (!currentCheapest || (version.prices?.usd && version.prices.usd < currentCheapest)) {
              cheapestDict[version.name] = version.prices.usd;
            }
            if (!currentCheapest || (version.prices?.usd_foil && version.prices.usd_foil < currentCheapest)) {
              cheapestDict[version.name] = version.prices.usd_foil;
            }
          }
        }
      }
    }

    let totalPriceOwned = 0;
    let totalPricePurchase = 0;
    for (const card of mainboard) {
      if (card.details) {
        if (card.cardID.includes('-') && !card.details.prices.usd && !card.details.prices.usd_foil) {
          const allVersionsOfCard = getIdsFromName(card.details.name) || [];
          allVersionsOfCard.forEach((id: string) => {
            const version = cardFromId(id);
            if (version.prices.usd) {
              totalPriceOwned += version.prices.usd;
            } else if (version.prices.usd_foil) {
              totalPriceOwned += version.prices.usd_foil;
            }
          });
        } else {
          if (card.finish === 'Foil') {
            totalPriceOwned += card.details.prices.usd_foil || 0;
          } else {
            totalPriceOwned += card.details.prices.usd || card.details.prices.usd_foil || 0;
          }
        }

        totalPricePurchase += cheapestDict[card.details.name] || 0;
      }
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeAboutPage',
      {
        cube: { ...cube, isInFeaturedQueue: !!isInQueue },
        cards,
        posts: blogs.items,
        postsLastKey: blogs.lastKey,
        changes: changes.items,
        changesLastKey: changes.lastKey,
        followed: req.user && cube.following && cube.following.some((id: string) => req.user!.id === id),
        followersCount,
        priceOwned: cube.priceVisibility === PRICE_VISIBILITY.PUBLIC ? totalPriceOwned : null,
        pricePurchase: cube.priceVisibility === PRICE_VISIBILITY.PUBLIC ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.name)} - About`,
        metadata: generateMeta(
          `Cube Cobra: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${baseUrl}/cube/about/${req.params.id}`,
        ),
        noindex:
          cube.visibility === CUBE_VISIBILITY.PRIVATE ||
          cube.visibility === CUBE_VISIBILITY.UNLISTED ||
          mainboard.length < 100,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/list/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [aboutHandler],
  },
];
