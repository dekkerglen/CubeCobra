import { cardOracleId } from '@utils/cardutil';
import type DraftType from '@utils/datatypes/Draft';
import {
  type DeckbuildJob,
  type DeckbuildJobCard,
  deckbuildJobKey,
  type DeckbuildJobSeat,
} from '@utils/drafting/deckbuildCore';
import { getCardDefaultRowColumn } from '@utils/draftutil';

import { getBucketName, putObject } from '../dynamo/s3client';
import { expandPicks } from './botDeckBuilder';
import { computeDeckbuildFacts } from './deckbuildFacts';

/**
 * The deckbuild job is a claim-check: when a draft is finished/published, the server writes
 * this self-contained payload to S3 and the SNS/SQS event carries only the draft id. The
 * bot-deckbuild lambda reads the job and builds the decks without ever loading carddb.
 */

const toJobCard = (draft: DraftType, index: number): DeckbuildJobCard | null => {
  const card = draft.cards[index];
  if (!card) return null;
  const oracle = cardOracleId(card);
  if (!oracle) return null;
  const { row, col } = getCardDefaultRowColumn(card);
  return { index, oracle, row, col };
};

/**
 * Build the deckbuild job for a draft's bot seats. Bot seats are identified by `seat.bot`;
 * each contributes its expanded picks (with the same voucher expansion the inline path uses).
 * Precomputes each card's oracle id and grid position, and the oracle facts, so the lambda
 * needs nothing from carddb.
 */
export const buildDeckbuildJob = (
  draft: DraftType,
  { maxSpells, maxLands }: { maxSpells: number; maxLands: number },
): DeckbuildJob => {
  const oracles = new Set<string>();
  const seats: DeckbuildJobSeat[] = [];

  for (let i = 0; i < draft.seats.length; i += 1) {
    const seat = draft.seats[i];
    if (!seat || !seat.bot) continue;

    const pool = expandPicks(draft, seat.pickorder ?? [])
      .map((index) => toJobCard(draft, index))
      .filter((c): c is DeckbuildJobCard => c !== null);

    for (const c of pool) oracles.add(c.oracle);
    seats.push({ seatIndex: i, pool });
  }

  const basics = (draft.basics ?? [])
    .map((index) => toJobCard(draft, index))
    .filter((c): c is DeckbuildJobCard => c !== null);
  for (const c of basics) oracles.add(c.oracle);

  return {
    draftId: draft.id,
    maxSpells,
    maxLands,
    seats,
    basics,
    facts: computeDeckbuildFacts(oracles),
  };
};

export const writeDeckbuildJob = async (job: DeckbuildJob): Promise<void> => {
  await putObject(getBucketName(), deckbuildJobKey(job.draftId), job);
};
