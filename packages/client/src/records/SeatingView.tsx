import React, { useMemo, useState } from 'react';

import Record, { formatRecord, playerRecord } from '@utils/datatypes/Record';

import Text from 'components/base/Text';

import { Seat } from './seating';
import SeatingTable from './SeatingTable';

interface SeatingViewProps {
  record: Record;
}

/**
 * The seating, read-only: the same round table the organiser arranges in SetTheTable, without
 * any of the controls that change it. Seating used to be reachable only through that editor,
 * which is owner-only — so a player at a live event had no way to look up their own chair.
 *
 * Unlike seatsFromPlayers, this pads nothing: an organiser sizing a table wants the empty
 * chairs to aim at, but a player reading one only wants the seats that exist.
 */
const SeatingView: React.FC<SeatingViewProps> = ({ record }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const seats = useMemo<Seat[]>(
    () => record.players.map((player, index) => ({ player, origin: index })),
    [record.players],
  );

  return (
    <SeatingTable
      seats={seats}
      pairings={null}
      selected={selected}
      // Tapping a chair highlights it and tapping it again clears it, so a player can mark
      // their own seat while finding it on a crowded table. No onSwap, so chairs don't drag.
      onSelect={(index) => setSelected((current) => (current === index ? null : index))}
      center={
        <>
          <Text xxl semibold className="rounded-md bg-bg-active px-2">
            {record.players.length}
          </Text>
          <Text xs className="text-text-secondary">
            {record.players.length === 1 ? 'player' : 'players'}
          </Text>
        </>
      }
      detail={(player) => formatRecord(playerRecord(record, player.name))}
      isInactive={(player) => (record.dropped ?? []).includes(player.name)}
    />
  );
};

export default SeatingView;
