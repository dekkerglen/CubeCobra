import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { GrabberIcon } from '@primer/octicons-react';
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

  const handleAddPlayer = useCallback(async () => {
    const raw = newPlayer.trim();
    if (!raw) {
      return;
    }

    // A leading @ opts in to linking the player to a CubeCobra account.
    const isHandle = raw.startsWith('@');
    const lookupName = isHandle ? raw.slice(1).trim() : raw;
    if (!lookupName) {
      return;
    }

    if (entries.some((entry) => entry.name.toLowerCase() === lookupName.toLowerCase())) {
      return;
    }

    if (!isHandle) {
      setEntries((prev) => [...prev, { uid: nextUid(), name: lookupName, originalIndex: -1 }]);
      setNewPlayer('');
      return;
    }

    setLoading(true);
    try {
      const response = await csrfFetch(`/api/user/getByUsername/${lookupName}`, {
        method: 'GET',
      });
      const { user } = await response.json();

      setEntries((prev) => [
        ...prev,
        {
          uid: nextUid(),
          name: user?.username || lookupName,
          userId: user?.id || undefined,
          originalIndex: -1,
        },
      ]);
      setNewPlayer('');
    } catch {
      setEntries((prev) => [...prev, { uid: nextUid(), name: lookupName, originalIndex: -1 }]);
      setNewPlayer('');
    } finally {
      setLoading(false);
    }
  }, [csrfFetch, newPlayer, entries, nextUid]);

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
                  <PlayerName player={entry}>{`Seat ${index + 1}. ${entry.name}`}</PlayerName>
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
