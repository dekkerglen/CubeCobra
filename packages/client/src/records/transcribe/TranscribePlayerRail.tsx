import React, { useCallback, useContext, useState } from 'react';

import { PencilIcon } from '@primer/octicons-react';
import Record, { formatRecord, PlayerList, playerRecord } from '@utils/datatypes/Record';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

import EditPlayerList from '../EditPlayerList';
import EditTrophies from '../EditTrophies';
import { TranscribeDeck } from './transcribeState';

interface TranscribePlayerRailProps {
  // The live state as a record, so standings and trophies read the same helpers the record
  // page does rather than a second implementation.
  record: Record;
  linkedUsers: User[];
  decks: { [playerIndex: number]: TranscribeDeck };
  setTrophy: (trophy: string[]) => void;
  // False when the record is backed by a played draft: the draft's seats are positionally
  // tied to the player list, so adding, removing and reordering are not offered at all.
  // Renaming still is — it is the one player edit such a record accepts.
  seatsEditable: boolean;
  // True while a save is in flight. Every player edit is held shut for the length of the
  // request: the page re-bases seatOrder to identity when the save lands, which is only
  // sound if no new permutation can have been created against the seats the server has
  // just moved.
  editsDisabled: boolean;
  // The edited list, plus the seat each entry came from in the list the editor was opened
  // on (-1 for a player added since). The page re-keys everything from that mapping.
  onApplyPlayers: (players: PlayerList, originSeats: number[]) => void;
}

// A leading @ links the player to a CubeCobra account, matching EditPlayerList.
const useResolvePlayer = () => {
  const { csrfFetch } = useContext(CSRFContext);

  return useCallback(
    async (raw: string): Promise<{ name: string; userId?: string } | null> => {
      const trimmed = raw.trim();
      const isHandle = trimmed.startsWith('@');
      const lookupName = isHandle ? trimmed.slice(1).trim() : trimmed;
      if (!lookupName) {
        return null;
      }
      if (!isHandle) {
        return { name: lookupName };
      }
      try {
        const response = await csrfFetch(`/api/user/getByUsername/${encodeURIComponent(lookupName)}`, {
          method: 'GET',
        });
        const { user } = await response.json();
        return { name: user?.username || lookupName, userId: user?.id || undefined };
      } catch {
        return { name: lookupName };
      }
    },
    [csrfFetch],
  );
};

const deckSummary = (deck: TranscribeDeck | undefined): string => {
  if (!deck || deck.mainboard.length === 0) {
    return 'no deck';
  }
  return `${deck.mainboard.length} cards`;
};

const TranscribePlayerRail: React.FC<TranscribePlayerRailProps> = ({
  record,
  linkedUsers,
  decks,
  setTrophy,
  seatsEditable,
  editsDisabled,
  onApplyPlayers,
}) => {
  const resolvePlayer = useResolvePlayer();
  const [playerEditorOpen, setPlayerEditorOpen] = useState<boolean>(false);
  const [trophyEditorOpen, setTrophyEditorOpen] = useState<boolean>(false);
  // EditPlayerList reports every keystroke's worth of change, each keyed against the list it
  // was seeded with. Staging them and applying once on Done keeps that mapping valid: the
  // page's players only move when the whole edit lands.
  const [staged, setStaged] = useState<{ players: PlayerList; originSeats: number[] }>({
    players: record.players,
    originSeats: record.players.map((_, index) => index),
  });

  const [renamingIndex, setRenamingIndex] = useState<number>(-1);
  const [renameValue, setRenameValue] = useState<string>('');
  const [renameError, setRenameError] = useState<string>('');

  const openPlayerEditor = () => {
    setStaged({ players: record.players, originSeats: record.players.map((_, index) => index) });
    setPlayerEditorOpen(true);
  };

  // The fieldset below makes these unreachable in a browser, but the invariant the page's
  // seatOrder re-base depends on is too load-bearing to rest on rendering alone: every path
  // that can reach onApplyPlayers refuses for itself while a save is open.
  const startRename = (index: number) => {
    const player = record.players[index];
    if (editsDisabled || !player) {
      return;
    }
    setRenamingIndex(index);
    setRenameValue(player.userId ? `@${player.name}` : player.name);
    setRenameError('');
  };

  const applyStagedPlayers = () => {
    if (editsDisabled) {
      return;
    }
    onApplyPlayers(staged.players, staged.originSeats);
    setPlayerEditorOpen(false);
  };

  const commitRename = async () => {
    if (editsDisabled) {
      return;
    }
    const resolved = await resolvePlayer(renameValue);
    if (!resolved) {
      setRenameError('Enter a name');
      return;
    }
    const taken = record.players.some(
      (player, index) => index !== renamingIndex && player.name.toLowerCase() === resolved.name.toLowerCase(),
    );
    if (taken) {
      setRenameError(`Another player is already named ${resolved.name}`);
      return;
    }
    onApplyPlayers(
      record.players.map((player, index) => (index === renamingIndex ? resolved : player)),
      record.players.map((_, index) => index),
    );
    setRenamingIndex(-1);
    setRenameError('');
  };

  return (
    <Flexbox direction="col" gap="2">
      <Flexbox direction="row" justify="between" alignItems="center" gap="2" wrap="wrap">
        <Text semibold>{`Players (${record.players.length})`}</Text>
        <Flexbox direction="row" gap="2">
          {seatsEditable && (
            <Button
              color="secondary"
              disabled={editsDisabled}
              onClick={() => (playerEditorOpen ? setPlayerEditorOpen(false) : openPlayerEditor())}
            >
              <span className="text-nowrap">{playerEditorOpen ? 'Close player editor' : 'Edit players'}</span>
            </Button>
          )}
          <Button color="secondary" onClick={() => setTrophyEditorOpen(!trophyEditorOpen)}>
            <span className="text-nowrap">{trophyEditorOpen ? 'Close trophies' : 'Edit trophies'}</span>
          </Button>
        </Flexbox>
      </Flexbox>

      {!seatsEditable && (
        <Text sm className="text-text-secondary">
          This record is attached to a played draft, so its players line up with the draft&apos;s seats and cannot be
          added, removed or reordered here. Renaming one is still fine.
        </Text>
      )}

      {/* A save rewrites the draft's seats into the submitted player order, and the page
          re-bases seatOrder to identity once it lands. Holding every player edit shut for
          the length of the request is what makes that re-base unambiguous: a reorder,
          add, remove or rename applied mid-flight would be expressed against seats the
          server has already moved, and the next save would misattribute every deck. */}
      <fieldset disabled={editsDisabled} className="min-w-0 border-0 p-0 m-0">
        {playerEditorOpen ? (
          <Flexbox direction="col" gap="2">
            <EditPlayerList
              players={record.players}
              setPlayers={(players) => setStaged((previous) => ({ ...previous, players }))}
              setSeatOrder={(originSeats) => setStaged((previous) => ({ ...previous, originSeats }))}
            />
            <Flexbox direction="row" gap="2">
              <Button color="primary" onClick={applyStagedPlayers}>
                Apply player changes
              </Button>
              <Button color="secondary" onClick={() => setPlayerEditorOpen(false)}>
                Cancel
              </Button>
            </Flexbox>
          </Flexbox>
        ) : (
          <Flexbox direction="col" gap="1">
            {record.players.map((player, index) => {
              const linked = linkedUsers.find((user) => user.id === player.userId);

              if (renamingIndex === index) {
                return (
                  <Flexbox key={index} direction="col" gap="1">
                    <Flexbox direction="row" gap="2" alignItems="center">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onEnter={commitRename}
                        placeholder="Player name (prefix with @ to link an account)"
                      />
                      <Button color="primary" onClick={commitRename}>
                        Save name
                      </Button>
                      <Button color="secondary" onClick={() => setRenamingIndex(-1)}>
                        Cancel
                      </Button>
                    </Flexbox>
                    {renameError && (
                      <Text sm className="text-danger">
                        {renameError}
                      </Text>
                    )}
                  </Flexbox>
                );
              }

              return (
                <Flexbox
                  key={index}
                  direction="row"
                  gap="2"
                  alignItems="center"
                  className="rounded-md border border-border px-3 py-1.5"
                >
                  {linked?.image?.uri ? (
                    <img src={linked.image.uri} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-bg-active border border-border shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">
                    {record.trophy?.includes(player.name) ? '🏆 ' : ''}
                    {player.name}
                  </span>
                  <Text sm className="text-text-secondary shrink-0">
                    {`${formatRecord(playerRecord(record, player.name))} • ${deckSummary(decks[index])}`}
                  </Text>
                  <button
                    type="button"
                    className="text-text-secondary hover:text-text"
                    aria-label={`Rename ${player.name}`}
                    onClick={() => startRename(index)}
                  >
                    <PencilIcon size={16} />
                  </button>
                </Flexbox>
              );
            })}
          </Flexbox>
        )}
      </fieldset>

      {trophyEditorOpen && <EditTrophies record={record} trophies={record.trophy} setTrophies={setTrophy} />}
    </Flexbox>
  );
};

export default TranscribePlayerRail;
