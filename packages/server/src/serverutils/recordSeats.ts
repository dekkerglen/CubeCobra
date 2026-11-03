import DraftSeat from '@utils/datatypes/DraftSeat';
import { PlayerList } from '@utils/datatypes/Record';
import { setupPicks } from '@utils/draftutil';

import { createPool } from './cube';

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
