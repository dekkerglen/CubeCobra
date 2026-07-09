import { CUBE_VISIBILITY, PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
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

    const cards = await cubeDao.getCards(cube.id, cube, { populate: false });
    const { mainboard } = cards;

    const followersCount = cube.likeCount ?? 0;
    const followed = !!req.user && (await cubeDao.getLike(cube.id, req.user.id));

    const isInQueue = await isInFeaturedQueue(cube);

    // calculate cube prices — read details directly from carddb instead of from
    // the card objects (cards arrive without details now; populate: false above)
    const nameToCards: Record<string, any[]> = {};
    const detailsByCardId: Record<string, any> = {};
    for (const card of mainboard) {
      const details = cardFromId(card.cardID);
      detailsByCardId[card.cardID] = details;
      if (details && !nameToCards[details.name]) {
        const allVersionsOfCard = getIdsFromName(details.name) || [];
        nameToCards[details.name] = allVersionsOfCard.map((id: string) => cardFromId(id));
      }
    }

    const cheapestDict: Record<string, number> = {};
    for (const card of mainboard) {
      const details = detailsByCardId[card.cardID];
      if (details) {
        const versions = nameToCards[details.name];
        if (!cheapestDict[details.name] && versions) {
          for (const version of versions) {
            if (!version) {
              continue;
            }
            const currentCheapest = cheapestDict[version.name];
            if (version.prices?.usd && (!currentCheapest || version.prices.usd < currentCheapest)) {
              cheapestDict[version.name] = version.prices.usd;
            }
            if (version.prices?.usd_foil && (!currentCheapest || version.prices.usd_foil < currentCheapest)) {
              cheapestDict[version.name] = version.prices.usd_foil;
            }
          }
        }
      }
    }

    let totalPriceOwned = 0;
    let totalPricePurchase = 0;
    for (const card of mainboard) {
      const details = detailsByCardId[card.cardID];
      if (details && card.cardID) {
        // cardID is typed as string, but legacy/bad S3 data can carry a non-string here;
        // guard before calling String methods so the page doesn't 500.
        if (
          typeof card.cardID === 'string' &&
          card.cardID.includes('-') &&
          !details.prices?.usd &&
          !details.prices?.usd_foil
        ) {
          const allVersionsOfCard = getIdsFromName(details.name) || [];
          allVersionsOfCard.forEach((id: string) => {
            const version = cardFromId(id);
            if (version?.prices?.usd) {
              totalPriceOwned += version.prices.usd;
            } else if (version?.prices?.usd_foil) {
              totalPriceOwned += version.prices.usd_foil;
            }
          });
        } else {
          if (card.finish === 'Foil') {
            totalPriceOwned += details.prices?.usd_foil || 0;
          } else {
            totalPriceOwned += details.prices?.usd || details.prices?.usd_foil || 0;
          }
        }

        totalPricePurchase += cheapestDict[details.name] || 0;
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
        followed,
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
