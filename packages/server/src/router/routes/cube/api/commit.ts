import Cube from 'dynamo/models/cube';
import Blog from 'dynamo/models/blog';
import Changelog from 'dynamo/models/changelog';
import Feed from 'dynamo/models/feed';
import { FeedTypes } from '@utils/datatypes/Feed';
import { Request, Response } from '../../../../types/express';

export const commitHandler = async (req: Request, res: Response) => {
  try {
    const { id, changes, title, blog, useBlog, expectedVersion } = req.body;

    if (!id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    let changeCount = 0;

    for (const [board] of Object.entries(changes)) {
      if ((changes as any)[board].swaps) {
        changeCount += (changes as any)[board].swaps.length;
      }
      if ((changes as any)[board].adds) {
        changeCount += (changes as any)[board].adds.length;
      }
      if ((changes as any)[board].removes) {
        changeCount += (changes as any)[board].removes.length;
      }
      if ((changes as any)[board].edits) {
        changeCount += (changes as any)[board].edits.length;
      }
    }

    if (changeCount <= 0) {
      return res.status(400).send({
        success: 'false',
        message: 'No changes',
      });
    }

    const cube = await Cube.getById(id);

    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!req.user || cube.owner.id !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (cube.version !== expectedVersion) {
      return res.status(409).send({
        success: 'false',
        message: 'Cube has been updated since changes were made.',
      });
    }

    const cards = await Cube.getCards(cube.id, true);

    for (const [board] of Object.entries(changes)) {
      // swaps
      if ((changes as any)[board].swaps) {
        for (const swap of (changes as any)[board].swaps) {
          (cards as any)[board][swap.index] = swap.card;
        }
      }
      // edits
      if ((changes as any)[board].edits) {
        for (const edit of (changes as any)[board].edits) {
          (cards as any)[board][edit.index] = {
            ...(cards as any)[board][edit.index],
            ...edit.newCard,
          };
        }
      }
      // removes
      if ((changes as any)[board].removes) {
        // sort removals desc
        const sorted = (changes as any)[board].removes.sort((a: any, b: any) => b.index - a.index);
        for (const remove of sorted) {
          (cards as any)[board].splice(remove.index, 1);
        }
      }
      // adds
      if ((changes as any)[board].adds) {
        for (const add of (changes as any)[board].adds) {
          (cards as any)[board].push({
            ...add,
          });
        }
      }
    }

    await Cube.updateCards(cube.id, cards);
    try {
      const changelogId = await Changelog.put(changes, cube.id);

      if (useBlog) {
        const blogId = await Blog.put({
          body: blog,
          owner: req.user.id,
          date: new Date().valueOf(),
          cube: cube.id,
          title,
          changelist: changelogId,
        });

        const followers = [...new Set([...(req.user.following || []), ...cube.following])];

        const feedItems = followers.map((user) => ({
          id: blogId,
          to: user,
          date: new Date().valueOf(),
          type: FeedTypes.BLOG,
        }));

        await Feed.batchPut(feedItems);
      }

      return res.status(200).send({
        success: 'true',
        updateApplied: true,
      });
    } catch (err) {
      const error = err as Error;
      req.logger.error(error.message, error.stack);
      return res.status(500).send({
        success: 'false',
        message: `Changes applied succesfully, but encountered an error creating history/blog/feed items: ${error.message}\n${error.stack}`,
        updateApplied: true,
      });
    }
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: `Failed to commit cube changes. ${error.message}\n${error.stack}`,
      updateApplied: false,
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [commitHandler],
  },
];
