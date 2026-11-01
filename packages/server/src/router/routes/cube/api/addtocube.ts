import Card, { DefaultPrintingPreference, isPrintingPreference } from '@utils/datatypes/Card';
import {
  boardNameToKey,
  getBoardDefinitions,
  isReservedBoardKey,
  safeCardImageUrl,
  sanitizeCardImageUrls,
} from '@utils/datatypes/Cube';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { FeedTypes } from '@utils/datatypes/Feed';
import { blogDao, changelogDao, cubeDao, feedDao, packageDao, userDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { cardFromId, getMostReasonableById } from 'serverutils/carddb';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';
import { newCard } from 'serverutils/util';

import { AppError } from '../../../../../errors/AppError';
import { ErrorCode } from '../../../../../errors/errorCodes';
import { Request, Response } from '../../../../types/express';
import { sanitizeLoreSeekerPack } from './commit';

export const addtocubeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!req.user || !isCubeEditable(cube, req.user)) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }

    if (!Array.isArray(req.body.cards)) {
      return res.status(400).send({
        success: 'false',
        message: 'No cards to add',
      });
    }

    const boardParam = req.body.board;
    if (boardParam !== undefined && boardParam !== null && typeof boardParam !== 'string') {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid board',
      });
    }

    const cubeCards = await cubeDao.getCards(cube.id);

    let tag: string | null = null;
    const autoTag = req.body.autoTag !== false; // Default to true
    const createBlogPost = req.body.createBlogPost !== false; // Default to true
    const addNotes = req.body.addNotes !== false; // Default to true
    // Opt-in, unlike the two above: callers that don't ask keep the printings they sent.
    const useDefaultPrinting = req.body.useDefaultPrinting === true;
    const printingPreference = isPrintingPreference(cube.defaultPrinting)
      ? cube.defaultPrinting
      : DefaultPrintingPreference;

    // Swap a requested printing for the one the cube prefers, keeping the original
    // whenever the preference can't resolve a printing (custom cards, unknown ids).
    const resolvePrinting = (id: string): string =>
      useDefaultPrinting ? (getMostReasonableById(id, printingPreference)?.scryfall_id ?? id) : id;

    // The package title drives three independent options (tagging, notes, the blog
    // post), so look it up whenever there's a package rather than only when tagging.
    let packageTitle: string | null = null;
    if (req.body.packid) {
      const pack = await packageDao.getById(req.body.packid);
      if (pack) {
        packageTitle = pack.title;
      }
    }
    tag = autoTag ? packageTitle : null;

    const adds: Card[] = req.body.cards.map((cardInput: string | any) => {
      // Handle both legacy format (string ID) and new format (custom card object)
      let baseCard: any;
      let customTags: string[] = [];
      const customProperties: any = {};

      if (typeof cardInput === 'string') {
        // Legacy format: just a card ID
        baseCard = newCard(cardFromId(resolvePrinting(cardInput)), tag ? [tag] : [], cube.defaultStatus || 'Owned');
      } else {
        // New format: card object with custom properties
        const cardId = cardInput.cardID || cardInput.id;
        baseCard = newCard(cardFromId(resolvePrinting(cardId)), tag ? [tag] : [], cube.defaultStatus || 'Owned');

        // Collect custom tags
        if (cardInput.tags && Array.isArray(cardInput.tags)) {
          customTags = cardInput.tags;
        }

        // Collect other custom properties
        if (cardInput.notes) {
          customProperties.notes = cardInput.notes;
        }
        if (cardInput.finish) {
          customProperties.finish = cardInput.finish;
        }
        if (cardInput.status) {
          customProperties.status = cardInput.status;
        }
        if (cardInput.colors && Array.isArray(cardInput.colors)) {
          customProperties.colors = cardInput.colors;
        }
        if (cardInput.type_line) {
          customProperties.type_line = cardInput.type_line;
        }
        if (cardInput.rarity) {
          customProperties.rarity = cardInput.rarity;
        }
        if (cardInput.cmc !== undefined) {
          customProperties.cmc = cardInput.cmc;
        }
        if (cardInput.custom_name) {
          customProperties.custom_name = cardInput.custom_name;
        }
        // Custom images are fetched server-side when pack images are rendered, so only plain
        // http(s) URLs are accepted; anything else is dropped.
        const imgUrl = safeCardImageUrl(cardInput.imgUrl);
        if (imgUrl) {
          customProperties.imgUrl = imgUrl;
        }
        const imgBackUrl = safeCardImageUrl(cardInput.imgBackUrl);
        if (imgBackUrl) {
          customProperties.imgBackUrl = imgBackUrl;
        }
        if (cardInput.colorCategory) {
          customProperties.colorCategory = cardInput.colorCategory;
        }
        if (cardInput.voucher_cards && Array.isArray(cardInput.voucher_cards)) {
          customProperties.voucher_cards = cardInput.voucher_cards;
          sanitizeCardImageUrls(customProperties);
        }
        if (cardInput.lore_seeker_pack) {
          const loreSeekerPack = sanitizeLoreSeekerPack(cardInput.lore_seeker_pack, baseCard.cardID);
          if (loreSeekerPack) {
            customProperties.lore_seeker_pack = loreSeekerPack;
          }
        }
      }

      // Merge custom tags with base card tags and package tag
      const allTags = [...(baseCard.tags || [])];
      if (customTags.length > 0) {
        customTags.forEach((customTag) => {
          if (!allTags.includes(customTag)) {
            allTags.push(customTag);
          }
        });
      }

      const c: Card = {
        ...baseCard,
        tags: allTags,
        ...customProperties,
      };

      if (addNotes && packageTitle) {
        c.notes = `Added from package "${packageTitle}": ${process.env.DOMAIN}/packages/${req.body.packid}`;
      }

      return c;
    });

    const boardKey = boardParam ? boardNameToKey(boardParam) : 'mainboard';

    // Validate board against cube's boards
    const boardDefs = getBoardDefinitions(cube, cubeCards);
    const validBoardKeys = boardDefs.map((b) => boardNameToKey(b.name)).filter((key) => !isReservedBoardKey(key));

    if (!validBoardKeys.includes(boardKey)) {
      return res.status(400).send({
        success: 'false',
        message: `Invalid board. Valid boards: ${boardDefs.map((b) => b.name).join(', ')}`,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(cubeCards, boardKey) || !Array.isArray(cubeCards[boardKey])) {
      cubeCards[boardKey] = [];
    }

    cubeCards[boardKey].push(...adds);

    await cubeDao.updateCards(cube.id, cubeCards);

    const changelist = await changelogDao.createChangelog(
      {
        [boardKey]: { adds },
      },
      cube.id,
    );

    if (req.body.packid && createBlogPost && packageTitle) {
      const id = await blogDao.createBlog({
        body: `Add from the package [${packageTitle}](/packages/${req.body.packid})`,
        owner: req.user.id,
        cube: cube.id,
        title: `Added Package "${packageTitle}"`,
        changelist,
      });

      // Only publish to follower feeds if the cube is public
      if (cube.visibility === CUBE_VISIBILITY.PUBLIC) {
        const [cubeLikers, userFollowers] = await Promise.all([
          cubeDao.getAllLikers(cube.id),
          userDao.getAllFollowers(req.user.id),
        ]);
        const followers = [...new Set([...userFollowers, ...cubeLikers])];

        const feedItems = followers.map((user) => ({
          id,
          to: user,
          date: new Date().valueOf(),
          type: FeedTypes.BLOG,
        }));

        await feedDao.batchPutUnhydrated(feedItems);
      }
    }

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    // A concurrent edit to the same cube can exhaust the DAO's optimistic-locking retries.
    // That's a client-recoverable conflict, not a server fault — return 409 and don't log it
    // as a backend error so it stays out of the error dashboards.
    if (err instanceof AppError && err.code === ErrorCode.OPTIMISTIC_LOCKING_VERSION_MISMATCH) {
      return res.status(409).send({
        success: 'false',
        message: 'This cube was modified by another request. Please try again.',
      });
    }

    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error adding to cube',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, addtocubeHandler],
  },
];
