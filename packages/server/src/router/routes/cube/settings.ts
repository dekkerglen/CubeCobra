import { PRICE_VISIBILITY } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import { cardFromId, getIdsFromName } from 'serverutils/carddb';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import { isInFeaturedQueue } from 'serverutils/featuredQueue';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const settingsHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    // Only cube owners can access settings
    if (!req.user || cube.owner.id !== req.user.id) {
      req.flash('danger', 'You do not have permission to access this page');
      return redirect(req, res, `/cube/list/${req.params.id}`);
    }

    const cards = await cubeDao.getCards(cube.id);
    const { mainboard } = cards;

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

    // Get backup versions for restore page
    const versions = await cubeDao.listCubeCardsVersions(cube.id);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeSettingsPage',
      {
        cube: { ...cube, isInFeaturedQueue: !!isInQueue },
        cards,
        versions,
        followed: req.user && cube.following && cube.following.some((id: string) => req.user!.id === id),
        followersCount,
        priceOwned: cube.priceVisibility === PRICE_VISIBILITY.PUBLIC ? totalPriceOwned : null,
        pricePurchase: cube.priceVisibility === PRICE_VISIBILITY.PUBLIC ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.name)} - Settings`,
        metadata: generateMeta(
          `Cube Cobra: ${cube.name}`,
          cube.brief,
          cube.image.uri,
          `${baseUrl}/cube/settings/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [settingsHandler],
  },
];

export default settingsHandler;
