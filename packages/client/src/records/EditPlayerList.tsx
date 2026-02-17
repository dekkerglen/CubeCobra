import React, { useCallback, useContext, useState } from 'react';

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
  players: PlayerList; // List of player names
  setPlayers: (value: PlayerList) => void;
}

const EditPlayerList: React.FC<EditPlayerListProps> = ({ players, setPlayers }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [newPlayer, setNewPlayer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleAddPlayer = useCallback(async () => {
    if (newPlayer.trim() && !players.map((p) => p.name.toLowerCase()).includes(newPlayer.trim().toLowerCase())) {
      setLoading(true);
      try {
        const response = await csrfFetch(`/api/user/getByUsername/${newPlayer.trim()}`, {
          method: 'GET',
        });
        const { user } = await response.json();

        const updatedPlayers: PlayerList = [
          ...players,
          {
            userId: user?.id || undefined, // Populate userId if user exists, otherwise omit
            name: user?.username || newPlayer.trim(), // Use the username from the response or the input value
          },
        ];
        setPlayers(updatedPlayers);
        setNewPlayer('');
      } catch {
        const updatedPlayers: PlayerList = [
          ...players,
          {
            name: newPlayer.trim(),
          },
        ];
        setPlayers(updatedPlayers);
        setNewPlayer('');
      } finally {
        setLoading(false);
      }
    }
  }, [csrfFetch, newPlayer, players, setPlayers]);

  const removeLastPlayer = useCallback(() => {
    const updatedPlayers = [...players];
    updatedPlayers.pop();
    setPlayers(updatedPlayers);
  }, [players, setPlayers]);

  const handleSortEnd = useCallback(
    (event: any) => {
      const { active, over } = event;

      // If sort ends without a collision, do nothing
      if (!over) {
        return;
      }

      if (active.id !== over.id) {
        const oldIndex = players.findIndex((player) => player.name === active.id);
        const newIndex = players.findIndex((player) => player.name === over.id);

        const updatedPlayers: PlayerList = [...players];
        const [removed] = updatedPlayers.splice(oldIndex, 1);
        updatedPlayers.splice(newIndex, 0, removed);

        setPlayers(updatedPlayers);
      }
    },
    [players, setPlayers],
  );

  const handleShufflePlayers = useCallback(() => {
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    setPlayers(shuffledPlayers);
  }, [players, setPlayers]);

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
            placeholder="Enter player name"
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
      <SortableList onDragEnd={handleSortEnd} items={players.map((player) => player.name)}>
        {players.map((player, index) => (
          <SortableItem key={player.name} id={player.name} className="p-1">
            {({ handleProps }) => (
              <Card>
                <Flexbox direction="row" justify="start" alignItems="center" className="p-2">
                  <div {...handleProps}>
                    <GrabberIcon size={16} className="cursor-grab mr-2" />
                  </div>
                  <PlayerName player={player}>{`Seat ${index + 1}. ${player.name}`}</PlayerName>
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
