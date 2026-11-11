import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import DraftSeat from '@utils/datatypes/DraftSeat';
import { PlayerList } from '@utils/datatypes/Record';
import { setupPicks } from '@utils/draftutil';

import { createPool } from './cube';

/**
 * Whether a record's draft records an event that actually happened, rather than
 * being the container an uploaded decklist was poured into.
 *
 * The distinction decides whether a draft's seats may be rewritten. An upload
 * draft's seats exist only to hold record decks — their `title` *is* the player
 * name, set that way when the draft is created. A played draft's seats are
 * historical: `title` is a deck name its owner typed, `owner` is the person who
 * actually drafted, `pickorder`/`trashorder` reference the packs they saw, and
 * `InitialState[i]` is tied to `seats[i]` by position alone.
 */
export const isPlayedDraft = (draft?: Pick<Draft, 'type'>): boolean => !!draft && draft.type !== DRAFT_TYPES.UPLOAD;

/**
 * Whether `seatOrder` leaves every player on the seat they already occupied —
 * no additions, removals or reordering. A rename alone satisfies this, which is
 * what lets a played draft's player names be corrected without touching its seats.
 */
export const seatAlignmentUnchanged = (seatOrder: number[], seatCount: number): boolean =>
  seatOrder.length === seatCount && seatOrder.every((origin, index) => origin === index);

/**
 * Keeps a draft's seats positionally aligned with a record's players.
 *
 * `seatOrder[i]` is the original seat index that the player now at position `i`
 * came from, or -1 for a newly added player. Reusing the old seat keeps each
 * player's deck attached as they move; -1 yields a fresh empty seat. Seats whose
 * player was removed are discarded.
 */
export const realignDraftSeats = (seats: DraftSeat[], seatOrder: number[], players: PlayerList): DraftSeat[] =>
  players.map((player, index) => {
    const origin = seatOrder[index] ?? -1;
    const existing = origin >= 0 ? seats[origin] : undefined;
    const base: DraftSeat = existing ?? { mainboard: createPool(), sideboard: setupPicks(1, 8) };
    return {
      ...base,
      owner: player.userId,
      title: player.name,
    };
  });
