import { FeedTypes } from '@utils/datatypes/Feed';
import Blog from 'dynamo/models/blog';
import Changelog from 'dynamo/models/changelog';
import Cube from 'dynamo/models/cube';
import Feed from 'dynamo/models/feed';
import Package from 'dynamo/models/package';
import { isCubeViewable } from 'serverutils/cubefn';
import { newCard } from 'serverutils/util';
import { ensureAuth } from 'src/router/middleware';

import { cardFromId } from '../../../../serverutils/carddb';
import { Request, Response } from '../../../../types/express';

export const addtocubeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    const cube = await Cube.getById(req.params.id);

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

    const cubeCards = await Cube.getCards(req.params.id, true);

    let tag: string | null = null;
    if (req.body.packid) {
      const pack = await Package.getById(req.body.packid);
      if (pack) {
        tag = pack.title;
      }
    }

    const adds = req.body.cards.map((id: string) => {
      const c: any = newCard(cardFromId(id), [tag]);
      c.notes = `Added from package "${tag}": ${process.env.DOMAIN}/packages/${req.body.packid}`;
      return c;
    });

    if (!['mainboard', 'maybeboard'].includes(req.body.board)) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid board',
      });
    }

    if (!cubeCards[req.body.board]) {
      cubeCards[req.body.board] = [];
    }

    if (tag) {
      cubeCards[req.body.board].push(...adds);
    } else {
      cubeCards[req.body.board].push(...req.body.cards.map((id: string) => newCard(cardFromId(id), [])));
    }

    await Cube.updateCards(req.params.id, cubeCards);

    const changelist = await Changelog.put(
      {
        [req.body.board]: { adds },
      },
      cube.id,
    );

    if (tag) {
      const id = await Blog.put({
        body: `Add from the package [${tag}](/packages/${req.body.packid})`,
        owner: req.user.id,
        date: new Date().valueOf(),
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

      await Feed.batchPut(feedItems);
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
