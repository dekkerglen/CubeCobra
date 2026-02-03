import Card from '@utils/datatypes/Card';
import { FeedTypes } from '@utils/datatypes/Feed';
import { blogDao, changelogDao, cubeDao, feedDao, packageDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';
import { cardFromId } from 'serverutils/carddb';
import { isCubeViewable } from 'serverutils/cubefn';
import { newCard } from 'serverutils/util';

import { Request, Response } from '../../../../types/express';

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

    if (!req.user || cube.owner.id !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }

    const cubeCards = await cubeDao.getCards(req.params.id);

    let tag: string | null = null;
    const autoTag = req.body.autoTag !== false; // Default to true
    const createBlogPost = req.body.createBlogPost !== false; // Default to true

    if (req.body.packid && autoTag) {
      const pack = await packageDao.getById(req.body.packid);
      if (pack) {
        tag = pack.title;
      }
    }

    const adds: Card[] = req.body.cards.map((cardInput: string | any) => {
      // Handle both legacy format (string ID) and new format (custom card object)
      let baseCard: any;
      let customTags: string[] = [];
      const customProperties: any = {};

      if (typeof cardInput === 'string') {
        // Legacy format: just a card ID
        baseCard = newCard(cardFromId(cardInput), tag ? [tag] : []);
      } else {
        // New format: card object with custom properties
        const cardId = cardInput.cardID || cardInput.id;
        baseCard = newCard(cardFromId(cardId), tag ? [tag] : []);

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
        if (cardInput.imgUrl) {
          customProperties.imgUrl = cardInput.imgUrl;
        }
        if (cardInput.imgBackUrl) {
          customProperties.imgBackUrl = cardInput.imgBackUrl;
        }
        if (cardInput.colorCategory) {
          customProperties.colorCategory = cardInput.colorCategory;
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

      if (tag) {
        c.notes = `Added from package "${tag}": ${process.env.DOMAIN}/packages/${req.body.packid}`;
      }

      return c;
    });

    const board = req.body.board as 'mainboard' | 'maybeboard';

    if (!['mainboard', 'maybeboard'].includes(board)) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid board',
      });
    }

    if (!cubeCards[board]) {
      cubeCards[board] = [];
    }

    cubeCards[board].push(...adds);

    await cubeDao.updateCards(req.params.id, cubeCards);

    const changelist = await changelogDao.createChangelog(
      {
        [board]: { adds },
      },
      req.params.id,
    );

    if (req.body.packid && createBlogPost && tag) {
      const id = await blogDao.createBlog({
        body: `Add from the package [${tag}](/packages/${req.body.packid})`,
        owner: req.user.id,
        cube: cube.id,
        title: `Added Package "${tag}"`,
        changelist,
      });

      const followers = [...new Set([...(req.user.following || []), ...cube.following])];

      const feedItems = followers.map((user) => ({
        id,
        to: user,
        date: new Date().valueOf(),
        type: FeedTypes.BLOG,
      }));

      await feedDao.batchPutUnhydrated(feedItems);
    }

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
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
