import { CARD_STATUSES, PrintingPreference } from '@utils/datatypes/Card';
import { NoticeType } from '@utils/datatypes/Notice';
import miscutil from '@utils/Util';
import Blog from 'dynamo/models/blog';
import Changelog from 'dynamo/models/changelog';
import Cube from 'dynamo/models/cube';
import CubeAnalytic from 'dynamo/models/cubeAnalytic';
import Draft from 'dynamo/models/draft';
import { FeaturedQueue } from 'dynamo/models/featuredQueue';
import Notice from 'dynamo/models/notice';
import p1p1PackModel from 'dynamo/models/p1p1Pack';
import User from 'dynamo/models/user';
import RSS from 'rss';
import { cardFromId, getIdsFromName } from 'serverutils/carddb';
import {
  abbreviate,
  cachePromise,
  compareCubes,
  generateBalancedPack,
  generatePack,
  isCubeListed,
  isCubeViewable,
} from 'serverutils/cubefn';
import { isInFeaturedQueue } from 'serverutils/featuredQueue';
import { generateSamplepackImage } from 'serverutils/imageUtils';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { addNotification, getBaseUrl, hasProfanity, isAdmin } from 'serverutils/util';
import { csrfProtection, ensureAuth, recaptcha } from 'router/middleware';
import { v4 as uuidv4 } from 'uuid';

import { Request, Response } from '../../types/express';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

export const addHandler = async (req: Request, res: Response) => {
  try {
    const {
      body: { name },
      user,
    } = req;
    if (!name || name.length < 5 || name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    if (hasProfanity(name)) {
      req.flash('danger', 'Cube name contains a banned word. If you feel this was a mistake, please contact us.');
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    // if this user has two empty cubes, we deny them from making a new cube
    const cubes = await Cube.getByOwner(user!.id);

    const emptyCubes = cubes.items.filter((cube) => cube.cardCount === 0);

    if (emptyCubes.length >= 2) {
      req.flash(
        'danger',
        'You may only have two empty cubes at a time. To create a new cube, please delete an empty cube, or add cards to it.',
      );
      return redirect(req, res, `/user/view/${user!.id}`);
    }

    // if this account is younger than a week, we deny them from making a new cube
    if ((req.user as any).dateCreated && Date.now() - (req.user as any).dateCreated < 1000 * 60 * 60 * 24 * 7) {
      const totalCubes = cubes.items.length;

      if (totalCubes > 2) {
        req.flash('danger', 'You may only have two cubes until your account is a week old.');
        return redirect(req, res, `/user/view/${user!.id}`);
      }
    }

    const cube = {
      id: uuidv4(),
      shortId: null,
      name: name,
      owner: user!.id,
      imageName: 'doubling cube [10e-321]',
      description: 'This is a brand new cube!',
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBILITY.PUBLIC,
      featured: false,
      tagColors: [],
      defaultFormat: -1,
      numDecks: 0,
      defaultSorts: [],
      showUnsorted: false,
      collapseDuplicateCards: false,
      formats: [],
      following: [],
      defaultStatus: 'Not Owned',
      defaultPrinting: 'recent' as const,
      disableAlerts: false,
      basics: [
        '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
        '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
        '19e71532-3f79-4fec-974f-b0e85c7fe701',
        '8365ab45-6d78-47ad-a6ed-282069b0fabc',
        '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
      ],
      tags: [],
      cardCount: 0,
    };

    await Cube.putNewCube(cube);

    await Cube.putCards({
      id: cube.id,
      mainboard: [],
      maybeboard: [],
    });

    req.flash('success', 'Cube created!');
    return redirect(req, res, `/cube/view/${cube.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/user/view/${req.user!.id}`);
  }
};

export const reportHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }
    const report = {
      subject: cube.owner.id,
      body: `"${cube.name}" was reported by ${req.user!.username}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.CUBE_REPORT,
    };

    await Notice.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report can decide whether to take action.',
    );

    return redirect(req, res, `/cube/overview/${req.params.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

export const removeHandler = async (req: Request, res: Response) => {
  try {
    const cubeId = req.params.id;
    if (!cubeId) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(cubeId);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/overview/404');
    }
    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/overview/${encodeURIComponent(cubeId)}`);
    }

    await Cube.deleteById(cubeId);

    req.flash('success', 'Cube Removed');
    return redirect(req, res, '/dashboard');
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const viewHandler = (req: Request, res: Response) => {
  return redirect(req, res, `/cube/overview/${req.params.id}`);
};

export const formatAddHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }
    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
    }

    let message = '';
    const { id, serializedFormat } = req.body;
    const format = JSON.parse(serializedFormat);

    format.defaultSeats = Number.parseInt(format.defaultSeats, 10);
    if (Number.isNaN(format.defaultSeats)) format.defaultSeats = 8;
    if (format.defaultSeats < 2 || format.defaultSeats > 16) {
      req.flash('danger', 'Default seat count must be between 2 and 16');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
    }

    if (id === '-1') {
      if (!cube.formats) {
        cube.formats = [];
      }
      cube.formats.push(format);
      message = 'Custom format successfully added.';
    } else {
      cube.formats[req.body.id] = format;
      message = 'Custom format successfully edited.';
    }

    await Cube.update(cube);
    req.flash('success', message);
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const formatRemoveHandler = async (req: Request, res: Response) => {
  try {
    const { cubeid, index } = req.params;
    const indexNum = parseInt(index!, 10);

    const cube = await Cube.getById(cubeid!);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
    }
    if (indexNum < 0 || indexNum >= cube.formats.length) {
      req.flash('danger', 'Invalid format index.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
    }

    cube.formats.splice(indexNum, 1);
    // update defaultFormat if necessary
    if (indexNum === cube.defaultFormat) {
      //When the current default format is deleted, revert to no default specified
      cube.defaultFormat = -1;
    } else if (indexNum < cube.defaultFormat) {
      /* If the format deleted isn't the default but is a custom format before it in the list, shift
       * the default format index to keep the alignment
       */
      cube.defaultFormat -= 1;
    }

    await Cube.update(cube);

    req.flash('success', 'Format removed.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid!)}`);
  } catch (err) {
    req.logger.error((err as Error).message, (err as Error).stack);
    req.flash('danger', 'Error removing format.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.cubeid!)}`);
  }
};

export const updateSettingsHandler = async (req: Request, res: Response) => {
  try {
    const { priceVisibility, disableAlerts, defaultStatus, defaultPrinting, visibility } = req.body;

    const errors = [];
    if (priceVisibility !== 'true' && priceVisibility !== 'false') {
      errors.push({ msg: 'Invalid Price visibility' });
    }
    if (disableAlerts !== 'true' && disableAlerts !== 'false') {
      errors.push({ msg: 'Invalid value for disableAlerts' });
    }
    if (!CARD_STATUSES.includes(defaultStatus)) {
      errors.push({ msg: 'Status must be valid.' });
    }
    if (![PrintingPreference.RECENT, PrintingPreference.FIRST].includes(defaultPrinting)) {
      errors.push({ msg: 'Printing must be valid.' });
    }
    if (!Object.values(Cube.VISIBILITY).includes(visibility)) {
      errors.push({ msg: 'Visibility must be valid' });
    }

    if (errors.length > 0) {
      req.flash('danger', 'Error updating cube: ' + errors.map((error) => error.msg).join(', '));
      return redirect(req, res, '/cube/overview/' + req.params.id);
    }

    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (!cube || cube.owner.id !== req.user!.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, '/cube/overview/' + req.params.id);
    }

    const update = req.body;
    for (const field of ['visibility', 'defaultStatus', 'defaultPrinting']) {
      if (update[field] !== undefined) {
        (cube as any)[field] = update[field];
      }
    }
    cube.disableAlerts = update.disableAlerts === 'true';
    cube.priceVisibility =
      update.priceVisibility === 'true' ? Cube.PRICE_VISIBILITY.PUBLIC : Cube.PRICE_VISIBILITY.PRIVATE;

    await Cube.update(cube);
    req.flash('success', 'Settings updated successfully.');
    return redirect(req, res, '/cube/overview/' + req.params.id);
  } catch (err) {
    req.flash('danger', 'Error updating settings. ' + (err as Error).message);
    req.logger.error('Error updating settings:', err);
    return redirect(req, res, '/cube/overview/' + req.params.id);
  }
};

export const defaultDraftFormatHandler = async (req: Request, res: Response) => {
  const cubeid = req.params.id!;
  const formatId = parseInt(req.params.formatId!, 10);

  const cube = await Cube.getById(cubeid);
  if (
    !isCubeViewable(cube, req.user) ||
    !cube ||
    cube.owner.id !== req.user!.id ||
    !Number.isInteger(formatId) ||
    formatId >= cube.formats.length ||
    formatId < -1
  ) {
    req.flash('danger', 'Invalid request.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
  }
  cube.defaultFormat = formatId;

  await Cube.update(cube);
  req.flash('success', 'Default draft format updated.');
  return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
};

export const overviewHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    const { mainboard } = cards;

    const blogs = await Blog.getByCube(cube.id, 1);

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

export const rssHandler = async (req: Request, res: Response) => {
  try {
    const split = req.params.id!.split(';');
    const cubeID = split[0];
    if (!cubeID) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(cubeID);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found`);
      return redirect(req, res, '/404');
    }

    const items = [];
    let queryResult: any = { lastKey: null };

    do {
      queryResult = await Blog.getByCube(cube.id, 128, queryResult.lastKey);
      items.push(...queryResult.items);
    } while (queryResult.lastKey);

    const baseUrl = getBaseUrl();
    const feed = new RSS({
      title: cube.name,
      feed_url: `${baseUrl}/cube/rss/${cube.id}`,
      site_url: baseUrl,
    });

    items.forEach((blog: any) => {
      if (blog.body && blog.Changelog) {
        feed.item({
          title: blog.title,
          url: `${baseUrl}/cube/blog/blogpost/${blog.id}`,
          description: `${blog.body}\n\n${Blog.changelogToText(blog.Changelog)}`,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.body) {
        feed.item({
          title: blog.title,
          url: `${baseUrl}/cube/blog/blogpost/${blog.id}`,
          description: blog.body,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.Changelog) {
        feed.item({
          title: blog.title,
          url: `${baseUrl}/cube/blog/blogpost/${blog.id}`,
          description: Blog.changelogToText(blog.Changelog),
          guid: blog.id,
          date: blog.date,
        });
      }
    });
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(feed.xml());
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const compareHandler = async (req: Request, res: Response) => {
  try {
    const { idA, idB } = req.params;

    const cubeAq = Cube.getById(idA!);
    const cubeBq = Cube.getById(idB!);

    const [cubeA, cubeB] = await Promise.all([cubeAq, cubeBq]);

    if (!isCubeViewable(cubeA, req.user) || !cubeA) {
      req.flash('danger', `Base cube not found: ${idA}`);
      return redirect(req, res, '/404');
    }
    if (!isCubeViewable(cubeB, req.user) || !cubeB) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return redirect(req, res, '/404');
    }

    const [cardsA, cardsB] = await Promise.all([Cube.getCards(cubeA.id), Cube.getCards(cubeB.id)]);

    const { aOracles, bOracles, inBoth, allCards } = await compareCubes(cardsA, cardsB);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube: cubeA,
        cubeB,
        onlyA: aOracles,
        onlyB: bOracles,
        both: inBoth.map((card: any) => card.details.oracle_id),
        cards: allCards.map((card: any, index: number) =>
          Object.assign(card, {
            index,
          }),
        ),
      },
      {
        title: `Comparing ${cubeA.name} to ${cubeB.name}`,
        metadata: generateMeta(
          'Cube Cobra Compare cubes',
          `Comparing "${cubeA.name}" To "${cubeB.name}"`,
          cubeA.image.uri,
          `${baseUrl}/cube/compare/${idA}/to/${idB}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const listHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeListPage',
      {
        cube,
        cards,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

export const historyHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const query = await Changelog.getByCube(cube.id, 36);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeHistoryPage',
      {
        cube,
        changes: query.items,
        lastKey: query.lastKey,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

export const getMoreChangelogsHandler = async (req: Request, res: Response) => {
  const { lastKey, cubeId } = req.body;
  const query = await Changelog.getByCube(cubeId, 18, lastKey);

  return res.status(200).send({
    success: 'true',
    posts: query.items,
    lastKey: (query as any).lastKey || null,
  });
};

export const getMoreDecksHandler = async (req: Request, res: Response) => {
  try {
    const { lastKey } = req.body;
    const query = await Draft.getByCube(req.params.id!, lastKey);

    return res.status(200).send({
      success: 'true',
      decks: query.items,
      lastKey: (query as any).lastKey || null,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      success: 'false',
    });
  }
};

export const analysisHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    const tokenMap: Record<string, any> = {};

    for (const [boardname, list] of Object.entries(cards)) {
      if (boardname !== 'id') {
        for (const card of list as any[]) {
          if (card.details.tokens) {
            for (const oracle of card.details.tokens) {
              const tokenDetails = cardFromId(oracle);
              tokenMap[oracle] = {
                tags: [],
                status: 'Not Owned',
                colors: tokenDetails.color_identity,
                cmc: tokenDetails.cmc,
                cardID: tokenDetails.scryfall_id,
                type_line: tokenDetails.type,
                addedTmsp: new Date(),
                finish: 'Non-foil',
                details: tokenDetails,
              };
            }
          }
        }
      }
    }

    const cubeAnalytics = await CubeAnalytic.getByCube(cube.id);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeAnalysisPage',
      {
        cube,
        cards,
        tokenMap,
        cubeAnalytics: cubeAnalytics || { cards: [] },
        cubeID: req.params.id,
      },
      {
        metadata: generateMeta(
          `Cube Cobra Analysis: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image.uri,
          `${baseUrl}/cube/analysis/${req.params.id}`,
        ),
        title: `${abbreviate(cube.name)} - Analysis`,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

export const playtestHandler = async (req: Request, res: Response) => {
  try {
    const cube = await Cube.getById(req.params.id!);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const decks = await Draft.getByCube(cube.id);

    // Get previous P1P1 packs for this cube
    let previousPacks: any[] = [];
    let previousPacksLastKey: any = null;
    try {
      const previousPacksResult = await p1p1PackModel.queryByCube(cube.id, undefined, 10);
      previousPacks = previousPacksResult.items || [];
      previousPacksLastKey = previousPacksResult.lastKey;
    } catch (error) {
      // If we can't get previous packs, just continue without them
      req.logger.error('Failed to fetch previous P1P1 packs:', error);
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubePlaytestPage',
      {
        cube,
        decks: decks.items,
        decksLastKey: (decks as any).lastKey || null,
        previousPacks,
        previousPacksLastKey,
      },
      {
        title: `${abbreviate(cube.name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/playtest/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/overview/${req.params.id}`);
  }
};

export const recentsHandler = async (req: Request, res: Response) => {
  const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC);

  return render(req, res, 'RecentlyUpdateCubesPage', {
    items: result.items.filter((cube: any) => isCubeListed(cube, req.user)),
    lastKey: result.lastKey,
  });
};

export const getMoreRecentsHandler = async (req: Request, res: Response) => {
  const { lastKey } = req.body;

  const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items.filter((cube: any) => isCubeListed(cube, req.user)),
    lastKey: result.lastKey,
  });
};

export const followHandler = async (req: Request, res: Response) => {
  const { user } = req;
  const cube = await Cube.getById(req.params.id!);

  if (!isCubeViewable(cube, user) || !cube) {
    req.flash('danger', 'Cube not found');
    return res.status(404).send({
      success: 'false',
    });
  }

  cube.following = [...new Set([...(cube.following || []), user!.id])];

  if (!user!.followedCubes) {
    user!.followedCubes = [];
  }

  if (!user!.followedCubes.some((id: string) => id === cube.id)) {
    user!.followedCubes.push(cube.id);
  }

  //TODO: Can remove after fixing models to not muck with the original input
  const cubeOwner = cube.owner;
  await User.update(user!);
  await Cube.update(cube);

  await addNotification(
    cubeOwner,
    user!,
    `/cube/overview/${cube.id}`,
    `${user!.username} followed your cube: ${cube.name}`,
  );

  return res.status(200).send({
    success: 'true',
  });
};

export const unfollowHandler = async (req: Request, res: Response) => {
  const cube = await Cube.getById(req.params.id!);

  if (!isCubeViewable(cube, req.user) || !cube) {
    req.flash('danger', 'Cube not found');
    return res.status(404).send({
      success: 'false',
    });
  }

  const { user } = req;
  cube.following = cube.following?.filter((id: string) => req.user!.id !== id) || [];
  user!.followedCubes = user!.followedCubes?.filter((id: string) => cube.id !== id) || [];

  await User.update(user!);
  await Cube.update(cube);

  return res.status(200).send({
    success: 'true',
  });
};

export const featureHandler = async (req: Request, res: Response) => {
  const redirectUrl = `/cube/overview/${encodeURIComponent(req.params.id!)}`;
  try {
    const { user } = req;
    if (!user || !isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, redirectUrl);
    }

    const cube = await Cube.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, redirectUrl);
    }
    if (cube.visibility !== Cube.VISIBILITY.PUBLIC) {
      req.flash('danger', 'Cannot feature a private cube');
      return redirect(req, res, redirectUrl);
    }

    const existingQueueItem = await isInFeaturedQueue(cube);
    if (existingQueueItem) {
      req.flash('danger', 'Cube is already in the featured queue');
      return redirect(req, res, redirectUrl);
    }

    await FeaturedQueue.put({
      cube: cube.id,
      date: Date.now().valueOf(),
      owner: typeof cube.owner === 'object' ? cube.owner.id : cube.owner,
      featuredOn: null,
    });

    req.flash('success', 'Cube added to featured queue successfully.');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err as Error, redirectUrl);
  }
};

export const unfeatureHandler = async (req: Request, res: Response) => {
  const redirectUrl = `/cube/overview/${encodeURIComponent(req.params.id!)}`;
  try {
    const { user } = req;
    if (!user || !isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, redirectUrl);
    }

    const cube = await Cube.getById(req.params.id!);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, redirectUrl);
    }

    const existingQueueItem = await isInFeaturedQueue(cube);
    if (!existingQueueItem) {
      req.flash('danger', 'Cube is not in the featured queue');
      return redirect(req, res, redirectUrl);
    }

    await FeaturedQueue.delete(cube.id);

    req.flash('success', 'Cube removed from featured queue successfully.');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err as Error, redirectUrl);
  }
};

// Helper function to generate pack image
const generatePackImage = async (pack: any[]): Promise<Buffer> => {
  const width = Math.floor(Math.sqrt((5 / 3) * pack.length));
  const height = Math.ceil(pack.length / width);

  const sources = pack.map((card, index) => {
    const x = (index % width) * CARD_WIDTH;
    const y = Math.floor(index / width) * CARD_HEIGHT;
    return {
      src: card.details?.image_normal || card.details?.image_small || '',
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
  });

  return generateSamplepackImage(sources, width * CARD_WIDTH, height * CARD_HEIGHT);
};

export const samplePackImageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.seed || !req.params.id) {
      req.flash('danger', 'Invalid parameters');
      return redirect(req, res, '/404');
    }

    req.params.seed = req.params.seed.replace('.png', '');
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.id);
    const isBalanced = req.query.balanced === 'true';

    const cacheKey = `/samplepack/${req.params.id}/${req.params.seed}${isBalanced ? '?balanced=true' : ''}`;
    const imageBuffer = await cachePromise(cacheKey, async () => {
      if (isBalanced) {
        const result = await generateBalancedPack(cube, cards, req.params.seed!, 10, null);
        return generatePackImage(result.packResult.pack);
      } else {
        const pack = await generatePack(cube, cards, req.params.seed);
        return generatePackImage(pack.pack);
      }
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
    });
    return res.end(imageBuffer);
  } catch (err) {
    req.flash('danger', (err as Error).message);
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id!)}`);
  }
};

export const p1p1Handler = async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;

    // Validate pack exists
    const pack = await p1p1PackModel.getById(packId!);
    if (!pack) {
      req.flash('danger', 'P1P1 pack not found');
      return redirect(req, res, '/404');
    }

    // Get cube data
    const cube = await Cube.getById(pack.cubeId);
    if (!cube) {
      req.flash('danger', 'Associated cube not found');
      return redirect(req, res, '/404');
    }

    // Calculate pack image dimensions
    const width = Math.floor(Math.sqrt((5 / 3) * pack.cards.length));
    const height = Math.ceil(pack.cards.length / width);

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'P1P1Page',
      {
        packId,
        cube,
      },
      {
        title: 'Pack 1 Pick 1',
        metadata: generateMeta(
          'Pack 1 Pick 1 - Cube Cobra',
          'Vote on your first pick from this pack!',
          `${baseUrl}/cube/p1p1packimage/${packId}.png`,
          `${baseUrl}/cube/p1p1/${packId}`,
          CARD_WIDTH * width,
          CARD_HEIGHT * height,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const p1p1PackImageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.packId) {
      req.flash('danger', 'Invalid pack ID');
      return redirect(req, res, '/404');
    }

    req.params.packId = req.params.packId.replace('.png', '');
    const { packId } = req.params;

    const pack = await p1p1PackModel.getById(packId);
    if (!pack || !pack.cards || pack.cards.length === 0) {
      req.flash('danger', 'P1P1 pack not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(pack.cubeId);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const imageBuffer = await cachePromise(`/p1p1pack/${packId}`, async () => {
      return generatePackImage(pack.cards);
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
      ETag: `"${packId}"`,
    });
    return res.end(imageBuffer);
  } catch (err) {
    req.flash('danger', (err as Error).message || 'Error generating pack image');
    return redirect(req, res, '/404');
  }
};

export const routes = [
  {
    path: '/add',
    method: 'post',
    handler: [csrfProtection, ensureAuth, recaptcha, addHandler],
  },
  {
    path: '/report/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, reportHandler],
  },
  {
    path: '/remove/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, removeHandler],
  },
  {
    path: '/view/:id',
    method: 'get',
    handler: [csrfProtection, viewHandler],
  },
  {
    path: '/format/add/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, formatAddHandler],
  },
  {
    path: '/format/remove/:cubeid/:index',
    method: 'get',
    handler: [csrfProtection, ensureAuth, formatRemoveHandler],
  },
  {
    path: '/updatesettings/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, updateSettingsHandler],
  },
  {
    path: '/:id/defaultdraftformat/:formatId',
    method: 'get',
    handler: [csrfProtection, ensureAuth, defaultDraftFormatHandler],
  },
  {
    path: '/overview/:id',
    method: 'get',
    handler: [overviewHandler],
  },
  {
    path: '/rss/:id',
    method: 'get',
    handler: [rssHandler],
  },
  {
    path: '/compare/:idA/to/:idB',
    method: 'get',
    handler: [compareHandler],
  },
  {
    path: '/list/:id',
    method: 'get',
    handler: [listHandler],
  },
  {
    path: '/history/:id',
    method: 'get',
    handler: [historyHandler],
  },
  {
    path: '/getmorechangelogs',
    method: 'post',
    handler: [getMoreChangelogsHandler],
  },
  {
    path: '/getmoredecks/:id',
    method: 'post',
    handler: [getMoreDecksHandler],
  },
  {
    path: '/analysis/:id',
    method: 'get',
    handler: [analysisHandler],
  },
  {
    path: '/playtest/:id',
    method: 'get',
    handler: [playtestHandler],
  },
  {
    path: '/recents',
    method: 'get',
    handler: [csrfProtection, recentsHandler],
  },
  {
    path: '/getmorerecents',
    method: 'post',
    handler: [csrfProtection, ensureAuth, getMoreRecentsHandler],
  },
  {
    path: '/follow/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, followHandler],
  },
  {
    path: '/unfollow/:id',
    method: 'post',
    handler: [csrfProtection, ensureAuth, unfollowHandler],
  },
  {
    path: '/feature/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, featureHandler],
  },
  {
    path: '/unfeature/:id',
    method: 'get',
    handler: [csrfProtection, ensureAuth, unfeatureHandler],
  },
  {
    path: '/samplepackimage/:id/:seed',
    method: 'get',
    handler: [samplePackImageHandler],
  },
  {
    path: '/p1p1/:packId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
    method: 'get',
    handler: [p1p1Handler],
  },
  {
    path: '/p1p1packimage/:packId',
    method: 'get',
    handler: [p1p1PackImageHandler],
  },
];
