import React, { useCallback, useContext, useMemo, useState } from 'react';
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
import { SortableItem, SortableList } from 'components/DND';

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
  const [order, setOrder] = useState<(string | null)[]>(draft.seats.map(() => null));
  const [players, setPlayers] = useState<string[]>([]);
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>({});
  const user = useContext(UserContext);
  const domain = useContext(DomainContext);

  useMount(() => {
    const run = async () => {
      socket.on('lobbyplayers', async (data) => {
        setPlayers(data);

        // TODO: if not all players have a seat, assign a seat and make an API call to reflect the change
      });

      socket.on('lobbyseats', async (data) => {
        const tempOrder: (string | null)[] = draft.seats.map(() => null);

        for (const [player, seat] of Object.entries(data)) {
          tempOrder[parseInt(seat as string)] = player;
        }

        setOrder(tempOrder);

        // TODO: if there is a collision, reassign a seat and make and API call to reflect the change
      });

      await callApi('/multiplayer/joinlobby', { draft: draft.id });

      const res = await callApi('/multiplayer/getlobbyseats', { draft: draft.id });
      const json = await res.json();

      const tempOrder: (string | null)[] = draft.seats.map(() => null);

      for (const [player, seat] of Object.entries(json.seats)) {
        tempOrder[parseInt(seat as string)] = player;
      }

      setOrder(tempOrder);
      setPlayers(json.players);
      setLoading(false);
    };
    run();
  });

  useMemo(() => {
    const run = async () => {
      const res = await callApi('/multiplayer/getusernames', { ids: players });
      const json = await res.json();

      setPlayerNameMap(json.users);
    };
    run();
  }, [players]);

  const onSortEnd = useCallback(
    async (event: any) => {
      const { active, over } = event;

      if (active.id !== over.id) {
        const newOrder = [...order];

        const [removed] = newOrder.splice(parseInt(active.id), 1);
        if (parseInt(active.id) < parseInt(over.id)) {
          // place it after over
          newOrder.splice(parseInt(over.id), 0, removed);
        } else {
          // place it before over
          newOrder.splice(parseInt(over.id), 0, removed);
        }

        const newSeats = Object.fromEntries(
          newOrder.map((player, i) => [player || '', i.toString()]).filter(([player]) => player),
        );

        setOrder(newOrder);

        await callApi('/multiplayer/updatelobbyseats', {
          draftid: draft.id,
          order: newSeats,
        });
      }
    },
    [order, draft.id],
  );

  console.log(order, playerNameMap);

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
          {order.map((player, i) => (
            <div className="pb-3" key={i}>
              {`Seat ${i + 1}: `} {player ? <Username user={playerNameMap[player]} nolink /> : BOT_NAME}
            </div>
          ))}
        </CardBody>
      </Card>
    );
  }

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
                    <div className="my-3" key={i}>{`Seat ${i + 1}`}</div>
                  ))}
                </Col>
                <Col xs={10}>
                  <div className="my-3">
                    <LockIcon size={16} /> {user.username}
                  </div>
                  <SortableList items={order.map((_, i) => `${i}`)} onDragEnd={(event: any) => onSortEnd(event)}>
                    {order.slice(1).map((player, i) => (
                      <SortableItem key={i + 1} id={`${i + 1}`} className="my-3">
                        {player ? <Username user={playerNameMap[player]} nolink /> : BOT_NAME}
                      </SortableItem>
                    ))}
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
