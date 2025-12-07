import { blogDao } from 'dynamo/daos';
import Cube from 'dynamo/models/cube';
import { cardFromId, getIdsFromName } from 'serverutils/carddb';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import { isInFeaturedQueue } from 'serverutils/featuredQueue';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const overviewHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    const { mainboard } = cards;

    const blogs = await blogDao.queryByCube(cube.id, undefined, 1);

    const followersCount = cube.following?.length || 0;

    const isInQueue = await isInFeaturedQueue(cube);

    // calculate cube prices
    const nameToCards: Record<string, any[]> = {};
    for (const card of mainboard) {
      if (!nameToCards[card.details.name]) {
        const allVersionsOfCard = getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionsOfCard.map((id: string) => cardFromId(id));
      }
    }

    const cheapestDict: Record<string, number> = {};
    for (const card of mainboard) {
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

    let totalPriceOwned = 0;
    let totalPricePurchase = 0;
    for (const card of mainboard) {
      //Per CardStatus in datatypes/Card.ts
      const isOwned = ['Ordered', 'Owned', 'Premium Owned'].includes(card.status);
      if (isOwned && card.details.prices) {
        if (card.finish === 'Foil') {
          totalPriceOwned += card.details.prices.usd_foil || card.details.prices.usd || 0;
        } else {
          totalPriceOwned += card.details.prices.usd || card.details.prices.usd_foil || 0;
        }
      }

      totalPricePurchase += cheapestDict[card.details.name] || 0;
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeOverviewPage',
      {
        cube: { ...cube, isInFeaturedQueue: !!isInQueue },
        cards,
        post: blogs && blogs.items.length > 0 ? blogs.items[0] : null,
        followed: req.user && cube.following && cube.following.some((id: string) => req.user!.id === id),
        followersCount,
        priceOwned: cube.priceVisibility === Cube.PRICE_VISIBILITY.PUBLIC ? totalPriceOwned : null,
        pricePurchase: cube.priceVisibility === Cube.PRICE_VISIBILITY.PUBLIC ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.name)} - Overview`,
        metadata: generateMeta(
          `Cube Cobra Overview: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/overview/${req.params.id}`,
        ),
        noindex:
          cube.visibility === Cube.VISIBILITY.PRIVATE ||
          cube.visibility === Cube.VISIBILITY.UNLISTED ||
          mainboard.length < 100,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/landing/${req.params.id}`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [overviewHandler],
  },
];
