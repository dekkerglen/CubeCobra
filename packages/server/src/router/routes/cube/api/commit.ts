import { BoardChanges } from '@utils/datatypes/Card';
import { boardNameToKey, CUBE_VISIBILITY, DEFAULT_BOARDS, isReservedBoardKey } from '@utils/datatypes/Cube';
import { FeedTypes } from '@utils/datatypes/Feed';
import { blogDao, cubeDao, feedDao, userDao } from 'dynamo/daos';
import { isCubeEditable } from 'serverutils/cubefn';

import { AppError } from '../../../../../errors/AppError';
import { ErrorCode } from '../../../../../errors/errorCodes';
import { Request, Response } from '../../../../types/express';

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidIndex = (index: unknown, length: number): boolean =>
  typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < length;

/**
 * Checks one board's change set against the board's current length. Swap, edit and remove
 * indices must address existing cards (adds always append), and every card must be an object
 * with a card ID. Returns a user-facing error, or null when the changes are well-formed.
 */
const validateBoardChanges = (boardChanges: Record<string, any>, length: number): string | null => {
  for (const op of ['adds', 'swaps', 'edits', 'removes'] as const) {
    if (boardChanges[op] !== undefined && boardChanges[op] !== null && !Array.isArray(boardChanges[op])) {
      return 'Invalid changes';
    }
  }

  const { adds = [], swaps = [], edits = [], removes = [] } = boardChanges as BoardChanges;

  for (const op of [...swaps, ...edits, ...removes]) {
    if (!isPlainObject(op) || !isValidIndex(op.index, length)) {
      return 'One of your changes refers to a card that is no longer in the cube. Refresh the page and try again.';
    }
  }

  const cards = [...adds, ...swaps.map((swap) => swap.card)];
  if (cards.some((card) => !isPlainObject(card) || typeof card.cardID !== 'string' || !card.cardID)) {
    return 'Invalid card in changes';
  }
  if (edits.some((edit) => !isPlainObject(edit.newCard))) {
    return 'Invalid card in changes';
  }

  return null;
};

export const commitHandler = async (req: Request, res: Response) => {
  try {
    const { id, changes, title, blog, useBlog, expectedVersion } = req.body;

    if (!id) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube ID is required',
      });
    }

    if (!isPlainObject(changes)) {
      return res.status(400).send({
        success: 'false',
        message: 'No changes',
      });
    }

    let changeCount = 0;

    for (const [board, boardChanges] of Object.entries(changes)) {
      if (board === 'version' || !isPlainObject(boardChanges)) continue;
      for (const op of ['swaps', 'adds', 'removes', 'edits'] as const) {
        if (Array.isArray(boardChanges[op])) {
          changeCount += boardChanges[op].length;
        }
      }
    }

    if (changeCount <= 0) {
      return res.status(400).send({
        success: 'false',
        message: 'No changes',
      });
    }

    const cube = await cubeDao.getById(id);

    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!req.user || !isCubeEditable(cube, req.user)) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if ((cube.version ?? 0) !== (expectedVersion ?? 0)) {
      return res.status(409).send({
        success: 'false',
        message:
          'This cube was updated since you started editing. Refresh the page to get the latest version, then redo your changes.',
      });
    }

    const cards = await cubeDao.getCards(cube.id);

    // Every key in `changes` except 'version' must name one of the cube's boards (or a default
    // board that hasn't been created yet, like 'basics'). Board keys are used for bracket
    // access below, so anything else (e.g. '__proto__') is rejected before touching `cards`.
    const validBoards = new Set(
      [...Object.keys(cards), ...DEFAULT_BOARDS.map((board) => boardNameToKey(board.name))].filter(
        (key) => !isReservedBoardKey(key),
      ),
    );
    for (const board of Object.keys(changes)) {
      if (board === 'version') continue;
      if (!validBoards.has(board) || !isPlainObject(changes[board])) {
        return res.status(400).send({
          success: 'false',
          message: 'Your changes refer to a board that does not exist in this cube. Refresh the page and try again.',
        });
      }
      const existing = Object.prototype.hasOwnProperty.call(cards, board) ? (cards as any)[board] : [];
      const error = validateBoardChanges(changes[board], Array.isArray(existing) ? existing.length : 0);
      if (error) {
        return res.status(400).send({
          success: 'false',
          message: error,
        });
      }
    }

    for (const [board] of Object.entries(changes)) {
      // Skip non-board keys like 'version'
      if (board === 'version') continue;

      // Ensure the board array exists (e.g., when adding cards to a new board like 'basics')
      if (!Object.prototype.hasOwnProperty.call(cards, board) || !Array.isArray((cards as any)[board])) {
        (cards as any)[board] = [];
      }

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

    // Commit the card changes and their changelog atomically. This is the core
    // durability guarantee: the cube version bump and the changelog are written
    // in a single DynamoDB transaction, so the cube can never advance a version
    // without a matching history entry (issue #2459).
    let newVersion: number;
    let changelogId: string;
    try {
      ({ version: newVersion, changelogId } = await cubeDao.commitCards(cube.id, cards, changes, expectedVersion));
    } catch (err) {
      // A concurrent commit to the same cube fails the transaction's version
      // condition. That's a client-recoverable conflict, not a server fault.
      if (err instanceof AppError && err.code === ErrorCode.OPTIMISTIC_LOCKING_VERSION_MISMATCH) {
        return res.status(409).send({
          success: 'false',
          message:
            'This cube was updated since you started editing. Refresh the page to get the latest version, then redo your changes.',
        });
      }
      throw err; // Nothing was committed; handled by the outer catch as a 500.
    }

    // The cube change and its changelog are now durable and consistent. The blog
    // post and follower feed are secondary — if they fail, the commit still stands.
    try {
      if (useBlog) {
        const blogId = await blogDao.createBlog({
          body: blog,
          owner: req.user.id,
          cube: cube.id,
          title,
          changelist: changelogId,
        });

        // Only publish to follower feeds if the cube is public
        if (cube.visibility === CUBE_VISIBILITY.PUBLIC) {
          const [cubeLikers, userFollowers] = await Promise.all([
            cubeDao.getAllLikers(cube.id),
            userDao.getAllFollowers(req.user.id),
          ]);
          const followers = [...new Set([...userFollowers, ...cubeLikers])];

          const feedItems = followers.map((user) => ({
            id: blogId,
            to: user,
            date: new Date().valueOf(),
            type: FeedTypes.BLOG,
          }));

          await feedDao.batchPutUnhydrated(feedItems);
        }
      }

      return res.status(200).send({
        success: 'true',
        updateApplied: true,
        version: newVersion,
      });
    } catch (err) {
      const error = err as Error;
      req.logger.error(error.message, error.stack);
      return res.status(500).send({
        success: 'false',
        message: `Changes and history were saved, but creating the blog/feed post failed: ${error.message}\n${error.stack}`,
        updateApplied: true,
        version: newVersion,
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
