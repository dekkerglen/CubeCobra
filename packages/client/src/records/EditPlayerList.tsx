import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { CheckIcon, GrabberIcon, PencilIcon, XIcon } from '@primer/octicons-react';
import { PlayerList } from '@utils/datatypes/Record';

import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';

import Button from '../components/base/Button';
import { Card } from '../components/base/Card';
import Input from '../components/base/Input';
import { Col, Flexbox, Row } from '../components/base/Layout';
import { SortableItem, SortableList } from '../components/DND';

// Each entry tracks the seat it originally came from so the server can
// reorder/insert/drop the associated draft seats in lockstep. originalIndex is
// -1 for a newly added player (the server gives it a fresh empty seat).
interface PlayerEntry {
  uid: string;
  name: string;
  userId?: string;
  originalIndex: number;
}

const PlayerName: React.FC<{ player: { name: string; userId?: string }; children: React.ReactNode }> = ({
  player,
  children,
}) => {
  if (player.userId) {
    return (
      <Link href={`/user/view/${player.userId}`}>
        <Text sm>{children}</Text>
      </Link>
    );
  }
  return <Text sm>{children}</Text>;
};

interface EditPlayerListProps {
  players: PlayerList; // List of player names (seed value; output is pushed via setPlayers)
  setPlayers: (value: PlayerList) => void;
  // Optional: parallel array describing, for each output seat, the original
  // seat index it came from (-1 for a new player). Used by the edit route to
  // keep draft.seats aligned with record.players. Omit when there is no draft
  // yet (e.g. record creation).
  setSeatOrder?: (value: number[]) => void;
}

const EditPlayerList: React.FC<EditPlayerListProps> = ({ players, setPlayers, setSeatOrder }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [newPlayer, setNewPlayer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const uidRef = useRef<number>(0);
  const nextUid = useCallback(() => {
    uidRef.current += 1;
    return `entry-${uidRef.current}`;
  }, []);

  // Seed entries once from the initial players. Subsequent player prop changes
  // are ignored — the editor owns this state and pushes updates outward.
  const [entries, setEntries] = useState<PlayerEntry[]>(() =>
    players.map((player, index) => ({
      uid: `seed-${index}`,
      name: player.name,
      userId: player.userId,
      originalIndex: index,
    })),
  );

  // Push derived players + seatOrder to the parent whenever entries change.
  // Keep the parent setters in refs so the effect doesn't refire (and loop)
  // when a parent passes a freshly-allocated setter on every render.
  const setPlayersRef = useRef(setPlayers);
  setPlayersRef.current = setPlayers;
  const setSeatOrderRef = useRef(setSeatOrder);
  setSeatOrderRef.current = setSeatOrder;

  useEffect(() => {
    setPlayersRef.current(entries.map(({ name, userId }) => (userId ? { name, userId } : { name })));
    setSeatOrderRef.current?.(entries.map((entry) => entry.originalIndex));
  }, [entries]);

  // A leading @ opts in to linking the player to a CubeCobra account. Returns
  // null for an empty entry.
  const resolvePlayer = useCallback(
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
        const response = await csrfFetch(`/api/user/getByUsername/${lookupName}`, {
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

  const isNameTaken = useCallback(
    (name: string, exceptUid?: string) =>
      entries.some((entry) => entry.uid !== exceptUid && entry.name.toLowerCase() === name.toLowerCase()),
    [entries],
  );

  const handleAddPlayer = useCallback(async () => {
    setLoading(true);
    try {
      const player = await resolvePlayer(newPlayer);
      if (!player || isNameTaken(player.name)) {
        return;
      }
      setEntries((prev) => [...prev, { uid: nextUid(), ...player, originalIndex: -1 }]);
      setNewPlayer('');
    } finally {
      setLoading(false);
    }
  }, [resolvePlayer, newPlayer, isNameTaken, nextUid]);

  // Renaming keeps the entry's originalIndex, so the player's seat (and deck)
  // stays attached and the server carries the new name through their results.
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [renameError, setRenameError] = useState<string>('');

  const startRename = useCallback((entry: PlayerEntry) => {
    setEditingUid(entry.uid);
    setEditingName(entry.userId ? `@${entry.name}` : entry.name);
    setRenameError('');
  }, []);

  const cancelRename = useCallback(() => {
    setEditingUid(null);
    setRenameError('');
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingUid) {
      return;
    }
    setLoading(true);
    try {
      const player = await resolvePlayer(editingName);
      if (!player) {
        setRenameError('Enter a name');
        return;
      }
      if (isNameTaken(player.name, editingUid)) {
        setRenameError(`Another player is already named ${player.name}`);
        return;
      }
      setEntries((prev) =>
        prev.map((entry) =>
          entry.uid === editingUid
            ? { uid: entry.uid, originalIndex: entry.originalIndex, name: player.name, userId: player.userId }
            : entry,
        ),
      );
      cancelRename();
    } finally {
      setLoading(false);
    }
  }, [editingUid, editingName, resolvePlayer, isNameTaken, cancelRename]);

  const removeLastPlayer = useCallback(() => {
    setEntries((prev) => prev.slice(0, -1));
  }, []);

  const handleSortEnd = useCallback((event: any) => {
    const { active, over } = event;

    // If sort ends without a collision, do nothing
    if (!over) {
      return;
    }

    if (active.id !== over.id) {
      setEntries((prev) => {
        const oldIndex = prev.findIndex((entry) => entry.uid === active.id);
        const newIndex = prev.findIndex((entry) => entry.uid === over.id);
        if (oldIndex === -1 || newIndex === -1) {
          return prev;
        }
        const updated = [...prev];
        const [removed] = updated.splice(oldIndex, 1);
        updated.splice(newIndex, 0, removed);
        return updated;
      });
    }
  }, []);

  const handleShufflePlayers = useCallback(() => {
    setEntries((prev) => [...prev].sort(() => Math.random() - 0.5));
  }, []);

  return (
    <Flexbox direction="col" gap="2">
      <Row xs={2} md={4}>
        <Col xs={2}>
          <Input
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddPlayer();
              }
            }}
            placeholder="Enter player name (prefix with @ to link an account)"
          />
        </Col>
        <Col xs={1}>
          <Button onClick={handleAddPlayer} color="primary" block disabled={loading}>
            {loading ? 'Adding...' : 'Add Player'}
          </Button>
        </Col>
        <Col xs={1}>
          <Button onClick={handleShufflePlayers} color="accent" block>
            Shuffle Players
          </Button>
        </Col>
      </Row>
      <SortableList onDragEnd={handleSortEnd} items={entries.map((entry) => entry.uid)}>
        {entries.map((entry, index) => (
          <SortableItem key={entry.uid} id={entry.uid} className="p-1">
            {({ handleProps }) => (
              <Card>
                <Flexbox direction="row" justify="start" alignItems="center" className="p-2">
                  <div {...handleProps}>
                    <GrabberIcon size={16} className="cursor-grab mr-2" />
                  </div>
                  {editingUid === entry.uid ? (
                    <Flexbox direction="col" gap="1" className="grow">
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <Text sm className="whitespace-nowrap">{`Seat ${index + 1}.`}</Text>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onEnter={commitRename}
                          placeholder="Player name (prefix with @ to link an account)"
                          otherInputProps={{ autoFocus: true }}
                        />
                        <Button color="primary" onClick={commitRename} disabled={loading}>
                          <CheckIcon size={16} />
                        </Button>
                        <Button color="secondary" onClick={cancelRename}>
                          <XIcon size={16} />
                        </Button>
                      </Flexbox>
                      {renameError && (
                        <Text sm className="text-danger">
                          {renameError}
                        </Text>
                      )}
                    </Flexbox>
                  ) : (
                    <>
                      <PlayerName player={entry}>{`Seat ${index + 1}. ${entry.name}`}</PlayerName>
                      <button
                        type="button"
                        className="ml-2 text-text-secondary hover:text-text"
                        aria-label={`Rename ${entry.name}`}
                        onClick={() => startRename(entry)}
                      >
                        <PencilIcon size={16} />
                      </button>
                    </>
                  )}
                </Flexbox>
              </Card>
            )}
          </SortableItem>
        ))}
        <Button color="danger" onClick={() => removeLastPlayer()}>
          Remove Last Player
        </Button>
      </SortableList>
    </Flexbox>
  );
};

export default EditPlayerList;
