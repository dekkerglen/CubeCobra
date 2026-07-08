import { cardOracleId, isVoucher } from '@utils/cardutil';
import DraftType from '@utils/datatypes/Draft';
import { getCardDefaultRowColumn, setupPicks } from '@utils/draftutil';
import { batchDeckbuild } from 'serverutils/draftbots';

/**
 * Shared bot (AI opponent) deck-building logic used by both the request path (cheap,
 * synchronous naive layout) and the async bot-deckbuild Lambda (ML-built decks).
 *
 * Everything here operates on a persisted `Draft` object so the Lambda can rebuild a
 * draft's bot decks from just its id: bot seats are identified by `seat.bot`, and each
 * bot's picks live in `seat.pickorder`, resolved against `draft.cards` / `draft.basics`.
 */

interface BotSeatInput {
  seatIndex: number;
  expandedPicks: number[];
}

/**
 * Voucher sub-cards are pre-expanded at draft creation time, so expanding a pick list
 * swaps each voucher for its `voucher_card_indices` and leaves everything else as-is.
 */
export const expandPicks = (draft: DraftType, picks: number[]): number[] => {
  const expanded: number[] = [];
  for (const pickIndex of picks) {
    const card = draft.cards[pickIndex];
    if (card && isVoucher(card) && card.voucher_card_indices && card.voucher_card_indices.length > 0) {
      expanded.push(...card.voucher_card_indices);
    } else {
      expanded.push(pickIndex);
    }
  }
  return expanded;
};

/**
 * Collect the bot seats that need decks built, with their expanded pick pools. Bots are
 * flagged via `seat.bot` (set at draft creation: `bot: seatIndex !== 0` for normal drafts,
 * `bot: player.isBot` for Draftmancer), so this is correct for both origins.
 */
const collectBotSeats = (draft: DraftType): BotSeatInput[] => {
  const botSeats: BotSeatInput[] = [];
  for (let i = 0; i < draft.seats.length; i += 1) {
    const seat = draft.seats[i];
    if (!seat || !seat.bot) continue;
    botSeats.push({ seatIndex: i, expandedPicks: expandPicks(draft, seat.pickorder ?? []) });
  }
  return botSeats;
};

/**
 * Lay each bot seat's picks out by their default row/column — no ML calls. Used on the
 * request path so a finished/published draft is immediately viewable; the async Lambda
 * later replaces these with ML-built decks. This is exactly the naive fallback the old
 * synchronous path used when ML was unavailable.
 */
export const applyNaiveBotLayout = (draft: DraftType): void => {
  for (const { seatIndex, expandedPicks } of collectBotSeats(draft)) {
    const mainboard = setupPicks(2, 8);
    const sideboard = setupPicks(1, 8);

    for (const index of expandedPicks) {
      const card = draft.cards[index];
      if (!card) continue;
      const { row, col } = getCardDefaultRowColumn(card);
      if (mainboard[row]?.[col]) {
        mainboard[row][col].push(index);
      }
    }

    const seat = draft.seats[seatIndex];
    if (seat) {
      seat.mainboard = mainboard;
      seat.sideboard = sideboard;
    }
  }
};

/**
 * Build every bot seat's deck via the ML service and assemble the results back onto the
 * draft's seats in place. Runs one batched ML call across all of the draft's bot seats.
 *
 * Throws if the ML service is unavailable so the caller (the Lambda) can retry the whole
 * draft rather than persisting half-built decks. The request path never calls this — it
 * uses `applyNaiveBotLayout` instead.
 */
export const buildBotDecks = async (
  draft: DraftType,
  { maxSpells, maxLands }: { maxSpells: number; maxLands: number },
): Promise<void> => {
  const botSeats = collectBotSeats(draft);
  if (botSeats.length === 0) return;

  const basicsCards = draft.basics.map((index) => draft.cards[index]?.details).filter(Boolean);
  const batchEntries = botSeats.map((bot) => ({
    pool: bot.expandedPicks.map((index) => draft.cards[index]?.details).filter(Boolean),
    basics: basicsCards,
    maxSpells,
    maxLands,
  }));

  const batchResults = await batchDeckbuild(batchEntries);

  for (let b = 0; b < botSeats.length; b += 1) {
    const { seatIndex, expandedPicks } = botSeats[b]!;
    const mlResult = batchResults?.[b];

    const formattedMainboard = setupPicks(2, 8);
    const formattedSideboard = setupPicks(1, 8);

    if (mlResult) {
      const { mainboard } = mlResult;
      const pool = expandedPicks.slice();
      const newMainboard: number[] = [];

      for (const oracle of mainboard) {
        const poolIndex = pool.findIndex((cardindex: number) => {
          const card = draft.cards[cardindex];
          return card ? cardOracleId(card) === oracle : false;
        });
        if (poolIndex === -1) {
          // try basics
          const basicsIndex = draft.basics.findIndex((cardindex) => {
            const card = draft.cards[cardindex];
            return card ? cardOracleId(card) === oracle : false;
          });
          if (basicsIndex !== -1) {
            newMainboard.push(draft.basics[basicsIndex]!);
          }
        } else {
          newMainboard.push(pool[poolIndex]!);
          pool.splice(poolIndex, 1);
        }
      }

      for (const index of newMainboard) {
        if (typeof index === 'number') {
          const card = draft.cards[index];
          if (card) {
            const { row, col } = getCardDefaultRowColumn(card);
            if (formattedMainboard[row] && formattedMainboard[row][col]) {
              formattedMainboard[row][col].push(index);
            }
          }
        }
      }

      for (const index of pool) {
        if (!draft.basics.includes(index) && typeof index === 'number') {
          const card = draft.cards[index];
          if (card) {
            const { col } = getCardDefaultRowColumn(card);
            if (formattedSideboard[0] && formattedSideboard[0][col]) {
              formattedSideboard[0][col].push(index);
            }
          }
        }
      }
    } else {
      // No ML result for this seat: fall back to putting all picks into the mainboard.
      for (const index of expandedPicks) {
        const card = draft.cards[index];
        if (card) {
          const { row, col } = getCardDefaultRowColumn(card);
          if (formattedMainboard[row] && formattedMainboard[row][col]) {
            formattedMainboard[row][col].push(index);
          }
        }
      }
    }

    const seat = draft.seats[seatIndex];
    if (seat) {
      seat.mainboard = formattedMainboard;
      seat.sideboard = formattedSideboard;
    }
  }
};
