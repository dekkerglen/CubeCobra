import { cardCmc, cardColorIdentity, cardImageUrl, cardName, cardOracleId, cardType } from '@utils/cardutil';
import DraftType, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { getDrafterState } from '@utils/draftutil';
import { cubeDao, draftDao } from 'dynamo/daos';
import { isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

// Most recent human drafts to include. Playtest analysis runs on demand and
// hydrates every draft's pick data (S3), so this bounds the download + request
// time on very large cubes. Older drafts beyond this are excluded (see `capped`).
const MAX_DRAFTS = 5000;

// One human draft's raw inputs for client-side playtest analysis. Everything is
// dictionary-encoded against the response's `oracles` array (index → oracle id)
// to keep the payload small: the same oracle id appears in many packs/decks.
interface PlaytestDraft {
  id: string;
  date: number;
  seats: number; // number of seats in this draft (for wheel detection)
  // The human seat's picks, in order. Each: picked oracle, the pack it was seen
  // in (oracle indices, includes the pick), pack number (0-based), pick position
  // within the pack (1-based).
  picks: { o: number; seen: number[]; pk: number; pip: number }[];
  mainboard: number[]; // oracle indices in the human seat's mainboard
  sideboard: number[]; // oracle indices in the human seat's sideboard
}

// Per-oracle card info for every card that appears in any included draft, so the
// client renders decks/charts even for cards no longer in the live cube.
interface CardInfo {
  name: string;
  imageUrl: string;
  type: string;
  cmc: number;
  colorIdentity: string[];
}

const ownerId = (owner: DraftType['owner']): string | undefined => (typeof owner === 'string' ? owner : owner?.id);

// The single human deck we analyze per draft: the draft owner's seat if present,
// otherwise the first non-bot seat, otherwise seat 0. (Most drafts are 1 human vs
// 7 bots; multi-human drafts still contribute exactly one deck.)
const humanSeatIndex = (draft: DraftType): number => {
  const owner = ownerId(draft.owner);
  if (owner) {
    const owned = draft.seats.findIndex((seat) => seat && !seat.bot && ownerId(seat.owner) === owner);
    if (owned >= 0) return owned;
  }
  const nonBot = draft.seats.findIndex((seat) => seat && !seat.bot);
  return nonBot >= 0 ? nonBot : 0;
};

export const playtestDataHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);
    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({ success: 'false', message: 'Cube not found' });
    }

    const oracles: string[] = [];
    const oracleIndex: Record<string, number> = {};
    const cards: Record<string, CardInfo> = {};

    // Intern an oracle id into the response dictionary, capturing its card info the
    // first time we see it. Returns the dictionary index (or -1 for unknown cards).
    const intern = (card: DraftType['cards'][number] | undefined): number => {
      if (!card) return -1;
      const oracle = cardOracleId(card);
      if (!oracle) return -1;
      let idx = oracleIndex[oracle];
      if (idx === undefined) {
        idx = oracles.length;
        oracleIndex[oracle] = idx;
        oracles.push(oracle);
        cards[oracle] = {
          name: cardName(card),
          imageUrl: cardImageUrl(card) || '',
          type: cardType(card) || '',
          cmc: cardCmc(card) || 0,
          colorIdentity: cardColorIdentity(card) || [],
        };
      }
      return idx;
    };

    const boardIndices = (board: number[][][] | undefined, draft: DraftType): number[] => {
      const out: number[] = [];
      for (const cardIndex of board?.flat(3) ?? []) {
        if (typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= draft.cards.length) continue;
        const idx = intern(draft.cards[cardIndex]);
        if (idx >= 0) out.push(idx);
      }
      return out;
    };

    const out: PlaytestDraft[] = [];
    let capped = false;
    let lastKey: any = undefined;

    do {
      const result = await draftDao.queryByCube(cube.id, lastKey);
      lastKey = result?.lastKey;
      const drafts = (result?.items ?? []) as DraftType[];

      for (const draft of drafts) {
        // Only real bot/human drafts can be reconstructed pick-by-pick.
        if (draft.type !== DRAFT_TYPES.DRAFT) continue;
        if (!Array.isArray(draft.InitialState) || draft.InitialState.length === 0) continue;
        if (!draft.seats || !draft.cards) continue;

        const seatIndex = humanSeatIndex(draft);
        const seat = draft.seats[seatIndex];
        if (!seat || seat.bot) continue;
        const pickorder = seat.pickorder;
        if (!pickorder || pickorder.length === 0) continue;

        try {
          const picks: PlaytestDraft['picks'] = [];
          for (let j = 0; j < pickorder.length; j++) {
            const state = getDrafterState(draft, seatIndex, j);
            const picked = state.selection;
            if (picked === undefined || picked < 0 || picked >= draft.cards.length) continue;
            const pickedIdx = intern(draft.cards[picked]);
            if (pickedIdx < 0) continue;
            const seen: number[] = [];
            for (const cardIndex of state.cardsInPack) {
              if (cardIndex < 0 || cardIndex >= draft.cards.length) continue;
              const idx = intern(draft.cards[cardIndex]);
              if (idx >= 0) seen.push(idx);
            }
            picks.push({ o: pickedIdx, seen, pk: state.pack ?? 0, pip: state.pick ?? 1 });
          }

          if (picks.length === 0) continue;

          out.push({
            id: draft.id,
            date: typeof draft.date === 'number' ? draft.date : new Date(draft.date).valueOf(),
            seats: draft.seats.length,
            picks,
            mainboard: boardIndices(seat.mainboard, draft),
            sideboard: boardIndices(seat.sideboard, draft),
          });
        } catch (err) {
          // A single malformed draft shouldn't sink the whole run.
          req.logger.error(`Failed to reconstruct draft ${draft.id}: ${(err as Error).message}`);
        }

        if (out.length >= MAX_DRAFTS) {
          capped = true;
          break;
        }
      }

      if (out.length >= MAX_DRAFTS) break;
    } while (lastKey);

    return res.status(200).send({ success: 'true', oracles, cards, drafts: out, capped });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({ success: 'false', message: 'Error loading playtest data' });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/:id',
    handler: [playtestDataHandler],
  },
];
