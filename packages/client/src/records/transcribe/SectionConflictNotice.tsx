import React from 'react';

import { PlayerList } from '@utils/datatypes/Record';
import { SectionKey } from '@utils/records/recordSections';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

import { resolvePlayerIndex, SaveConflict } from './transcribeState';

const OVERRIDE_PREFIX = 'overrides:';
const DECK_PREFIX = 'decks:';

// Names whichever player a `overrides:<key>`/`decks:<key>` conflict is about, using the
// current player list — the best this workspace can do once the other side may have renamed
// or removed them.
const playerLabel = (key: string, players: PlayerList, noun: string): string => {
  const rawKey = key.startsWith(OVERRIDE_PREFIX) ? key.slice(OVERRIDE_PREFIX.length) : key.slice(DECK_PREFIX.length);
  const index = resolvePlayerIndex(rawKey, players);
  const name = index === -1 ? undefined : players[index]?.name;
  return name ? `${name}'s ${noun}` : `a removed player's ${noun}`;
};

// A human name for a SectionKey, used both in the page-level alert and on a single marker.
export const describeSection = (key: SectionKey, players: PlayerList): string => {
  switch (key) {
    case 'overview':
      return 'Event details';
    case 'players':
      return 'Players';
    case 'rounds':
      return 'Rounds';
    case 'trophy':
      return 'Trophy';
    default:
      return key.startsWith(OVERRIDE_PREFIX) ? playerLabel(key, players, 'record') : playerLabel(key, players, 'deck');
  }
};

// Names every refused section at the top of the page. Purely informational — each section's
// own card carries the controls to actually resolve it, so a conflict is never more than one
// click away from the data it is about.
export const ConflictsAlert: React.FC<{ conflicts: SaveConflict[]; players: PlayerList }> = ({
  conflicts,
  players,
}) => {
  if (conflicts.length === 0) {
    return null;
  }
  return (
    <Alert color="warning">
      <div data-testid="conflicts-alert">
        <Flexbox direction="col" gap="1">
          <Text sm semibold>
            {conflicts.length === 1
              ? 'One section could not be saved — someone else changed it since this record was loaded.'
              : `${conflicts.length} sections could not be saved — someone else changed them since this record was loaded.`}
          </Text>
          <ul className="mb-0">
            {conflicts.map((conflict) => (
              <li key={conflict.section}>
                <Text sm>{describeSection(conflict.section, players)}</Text>
              </li>
            ))}
          </ul>
        </Flexbox>
      </div>
    </Alert>
  );
};

// The marker and the two resolutions for exactly one conflicted section, meant to sit inside
// the card that section belongs to — never a modal, so the rest of what the user typed stays
// on screen and nothing about resolving this costs them any of it.
export const SectionConflictMarker: React.FC<{
  conflict: SaveConflict;
  players: PlayerList;
  onKeepTheirs: () => void;
  onKeepMine: () => void;
  disabled?: boolean;
}> = ({ conflict, players, onKeepTheirs, onKeepMine, disabled = false }) => {
  const label = describeSection(conflict.section, players);
  return (
    <div
      data-testid={`section-conflict-${conflict.section}`}
      className="rounded-md border border-orange-400 bg-yellow-100 p-2"
    >
      <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
        <Text sm className="text-yellow-800">
          {`${label}: changed by someone else since this record was loaded.`}
        </Text>
        <Flexbox direction="row" gap="2">
          <Button
            type="button"
            color="secondary"
            disabled={disabled}
            onClick={onKeepTheirs}
            aria-label={`Keep the stored ${label}`}
          >
            Keep theirs
          </Button>
          <Button
            type="button"
            color="secondary"
            disabled={disabled}
            onClick={onKeepMine}
            aria-label={`Keep my ${label}`}
          >
            Keep mine
          </Button>
        </Flexbox>
      </Flexbox>
    </div>
  );
};
