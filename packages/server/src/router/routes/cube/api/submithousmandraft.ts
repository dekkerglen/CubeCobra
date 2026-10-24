import { DRAFT_TYPES, HousmanLogEntry, mergeSubmittedSeats } from '@utils/datatypes/Draft';
import { draftDao } from 'dynamo/daos';
import { ensureAuth } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

// Far above any real Housman draft (a few exchanges per seat per round).
const MAX_LOG_ENTRIES = 5000;

const isBoundedInt = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < max;

/**
 * Rebuilds the client's exchange log from known fields only. Returns null when any entry
 * doesn't address a real seat, round and card of this draft.
 */
const sanitizeHousmanLog = (
  log: unknown[],
  seatCount: number,
  roundCount: number,
  cardCount: number,
): HousmanLogEntry[] | null => {
  if (log.length > MAX_LOG_ENTRIES) {
    return null;
  }
  const entries: HousmanLogEntry[] = [];
  for (const entry of log) {
    if (typeof entry !== 'object' || entry === null) {
      return null;
    }
    const { seat, round, given, taken } = entry as Record<string, unknown>;
    if (
      !isBoundedInt(seat, seatCount) ||
      !isBoundedInt(round, roundCount) ||
      !isBoundedInt(given, cardCount) ||
      !isBoundedInt(taken, cardCount)
    ) {
      return null;
    }
    entries.push({ seat, round, given, taken });
  }
  return entries;
};

export const submithousmandraftHandler = async (req: Request, res: Response) => {
  try {
    if (!req.body.id) {
      return res.status(400).send({
        success: 'false',
        message: 'Draft ID is required',
      });
    }

    const draft = await draftDao.getById(req.body.id);

    if (!draft) {
      return res.status(404).send({
        success: 'false',
        message: 'Draft not found',
      });
    }

    if (draft.type !== DRAFT_TYPES.HOUSMAN) {
      return res.status(400).send({
        success: 'false',
        message: 'Draft is not a housman draft',
      });
    }

    const ownerId = typeof draft.owner === 'string' ? draft.owner : draft.owner?.id;
    if (!req.user || !ownerId || ownerId !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (draft.complete) {
      return res.status(409).send({
        success: 'false',
        message: 'This draft has already been submitted.',
      });
    }

    const cardCount = draft.cards.length;

    // Only the deck-building fields come from the client; owner, bot and name stay as stored.
    const seats = mergeSubmittedSeats(draft.seats, req.body.seats, cardCount, ['mainboard', 'sideboard', 'pickorder']);
    if (!seats) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid draft seats',
      });
    }

    // The exchange log powers the post-draft pick-by-pick breakdown. Persist it if provided.
    const { log } = req.body;
    let housmanLog: HousmanLogEntry[] | null = null;
    if (Array.isArray(log)) {
      housmanLog = sanitizeHousmanLog(log, seats.length, draft.InitialState?.length ?? 0, cardCount);
      if (!housmanLog) {
        return res.status(400).send({
          success: 'false',
          message: 'Invalid draft log',
        });
      }
    }

    draft.seats = seats;
    if (housmanLog) {
      draft.HousmanLog = housmanLog;
    }
    draft.complete = true;

    await draftDao.update(draft);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error submitting housman draft',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuth, submithousmandraftHandler],
  },
];
