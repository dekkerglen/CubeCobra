import React, { useContext, useMemo, useState } from 'react';
import { callApi } from 'utils/CSRF';
import useMount from 'hooks/UseMount';
import UserContext from 'contexts/UserContext';
import DomainContext from 'contexts/DomainContext';
import { Card, CardBody, CardHeader, CardFooter } from 'components/base/Card';
import { Row, Col } from 'components/base/Layout';
import Text from 'components/base/Text';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import Spinner from 'components/base/Spinner';
import Username from 'components/Username';
import { PasteIcon, LockIcon } from '@primer/octicons-react';
import Draft from 'datatypes/Draft';
import { SortableList } from 'components/DND';

const BOT_NAME = 'Bot';

interface CubeDraftStagingProps {
  draft: Draft;
  socket: {
    on: (event: string, callback: (data: any) => void) => void;
  };
  start: () => void;
}

const CubeDraftStaging: React.FC<CubeDraftStagingProps> = ({ draft, socket, start }) => {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Record<string, string>>({});
  const [players, setPlayers] = useState<string[]>([]);
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>({});
  const user = useContext(UserContext);
  const domain = useContext(DomainContext);

  const seats: string[] = [];

  for (let i = 0; i < draft.seats.length; i++) {
    let seat = BOT_NAME;

    for (const [key, value] of Object.entries(order)) {
      if (value === `${i}`) {
        seat = key;
      }
    }

    seats.push(seat);
  }

  useMount(() => {
    const run = async () => {
      socket.on('lobbyplayers', async (data) => {
        setPlayers(data);

        // TODO: if not all players have a seat, assign a seat and make an API call to reflect the change
      });

      socket.on('lobbyseats', async (data) => {
        setOrder(data);

        // TODO: if there is a collision, reassign a seat and make and API call to reflect the change
      });

      await callApi('/multiplayer/joinlobby', { draft: draft.id });

      const res = await callApi('/multiplayer/getlobbyseats', { draft: draft.id });
      const json = await res.json();

      setOrder(json.seats);
      setPlayers(json.players);
      setLoading(false);
    };
    run();
  });

  const editableRows = seats.map((seat, i) => {
    return {
      element: (
        <div className="clickable pb-3" key={i}>
          {seat === BOT_NAME ? <>{BOT_NAME}</> : <Username user={playerNameMap[seat]} nolink />}
        </div>
      ),
      key: `${i}`,
    };
  });

  // const onSortEnd = async ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }): Promise<void> => {
  //   const newSeats = { ...order };
  //   newSeats[seats[oldIndex]] = `${newIndex}`;
  //   newSeats[seats[newIndex]] = `${oldIndex}`;

  //   // TODO: make API call to update seat orders
  //   await callApi('/multiplayer/updatelobbyseats', {
  //     draftid: draft.id,
  //     order: newSeats,
  //   });

  //   setOrder(newSeats);
  // };

  useMemo(() => {
    const run = async () => {
      const res = await callApi('/multiplayer/getusernames', { ids: players });
      const json = await res.json();

      setPlayerNameMap(json.users);
    };
    run();
  }, [players]);

  if (user?.id !== players[0]) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <Text semibold lg>
            Setting Up Draft...
          </Text>
        </CardHeader>
        <CardBody>
          <div className="centered py-3">
            <Spinner className="position-absolute" />
          </div>
          <p>The draft owner is currently setting up the draft, please wait.</p>
          {seats.map((seat, i) => (
            <div className="pb-3" key={i}>
              {`Seat ${i + 1}: `}{' '}
              {seat === BOT_NAME ? BOT_NAME : <Username user={playerNameMap[seats[i]] || seats[i]} nolink />}
            </div>
          ))}
        </CardBody>
      </Card>
    );
  }
  console.log(draft);

  return (
    <Card className="mt-4">
      <CardHeader>
        <Text semibold lg>
          Setting Up Draft...
        </Text>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="centered py-3">
            <Spinner className="position-absolute" />
          </div>
        ) : (
          <Row>
            <Col xs={12} lg={6}>
              <p>Use the following link to invite players to your draft:</p>
              <div className="flex items-center">
                <Input value={`https://${domain}/d/${draft.id}`} readOnly />
                <Button
                  className="btn-sm ml-2"
                  onClick={() => navigator.clipboard.writeText(`https://${domain}/d/${draft.id}`)}
                  aria-label="Copy short ID"
                >
                  <PasteIcon size={16} />
                </Button>
              </div>
            </Col>
            <Col xs={12} lg={6}>
              <i>Click and drag seats to reposition players and bots.</i>
              <Row>
                <Col xs={2}>
                  {draft.seats.map((_, i) => (
                    <div className="pb-3" key={i}>{`Seat ${i + 1}`}</div>
                  ))}
                </Col>
                <Col xs={10}>
                  <div className="pb-3">
                    <LockIcon size={16} /> {user.username}
                  </div>
                  <SortableList items={editableRows.map((row) => row.key)}>
                    {editableRows.map((row) => row.element)}
                  </SortableList>
                </Col>
              </Row>
            </Col>
          </Row>
        )}
      </CardBody>
      <CardFooter>
        <Button color="primary" block onClick={start} disabled={loading}>
          Start Draft
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CubeDraftStaging;
