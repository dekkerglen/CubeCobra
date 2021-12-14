import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';
import useMount from 'hooks/UseMount';
import { callApi } from 'utils/CSRF';

import UserContext from 'contexts/UserContext';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { ClippyIcon, LockIcon } from '@primer/octicons-react';
import Username from 'components/Username';

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Spinner,
  Row,
  Col,
  Input,
  InputGroup,
  InputGroupAddon,
} from 'reactstrap';

const BOT_NAME = 'Bot';

const SortableItem = SortableElement(({ value }) => <div className="sortable-item">{value}</div>);

const SortableList = SortableContainer(({ items }) => {
  return (
    <div>
      {items.map(({ element, key }, index) => <SortableItem key={key} index={index} value={element} />).slice(1)}
    </div>
  );
});

const CubeDraft = ({ draft, socket, start }) => {
  const [loading, setLoading] = React.useState(true);
  const [order, setOrder] = React.useState({});
  const [players, setPlayers] = React.useState([]);
  const user = useContext(UserContext);

  const seats = [];

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

      await callApi('/multiplayer/joinlobby', { draft: draft._id });

      const res = await callApi('/multiplayer/getlobbyseats', { draft: draft._id });
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
        <div className="tag-color-row clickable pb-3">
          {seats[i] === BOT_NAME ? <>{BOT_NAME}</> : <Username userId={seats[i]} nolink />}
        </div>
      ),
      key: i,
    };
  });

  const onSortEnd = async ({ oldIndex, newIndex }) => {
    const newSeats = { ...order };
    newSeats[seats[oldIndex]] = `${newIndex}`;
    newSeats[seats[newIndex]] = `${oldIndex}`;

    // TODO: make API call to update seat orders
    await callApi('/multiplayer/updatelobbyseats', {
      draftid: draft._id,
      order: newSeats,
    });

    setOrder(newSeats);
  };

  if (user.id !== players[0]) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <h4>Setting Up Draft...</h4>
        </CardHeader>
        <CardBody>
          <div className="centered py-3">
            <Spinner className="position-absolute" />
          </div>
          <p>The draft owner is currently setting up the draft, please wait.</p>
          {seats.map((seat, i) => (
            <div className="pb-3">
              {`Seat ${i + 1}: `} {seat === BOT_NAME ? BOT_NAME : <Username userId={seat} nolink />}
            </div>
          ))}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <h4>Setting Up Draft...</h4>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="centered py-3">
            <Spinner className="position-absolute" />
          </div>
        ) : (
          <>
            <p>Use the following link to invite players to your draft:</p>
            <InputGroup>
              <Input className="bg-white monospaced" value={`https://cubecobra.com/d/${draft._id}`} readonly />
              <InputGroupAddon addonType="append">
                <Button
                  className="btn-sm input-group-button"
                  onClick={() => navigator.clipboard.writeText(`https://cubecobra.com/d/${draft._id}`)}
                  aria-label="Copy Short ID"
                >
                  <ClippyIcon size={16} />
                </Button>
              </InputGroupAddon>
            </InputGroup>
            <br />
            <i>Click and drag seats to reposition players and bots.</i>
            <Row noGutters>
              <Col xs={3}>
                {draft.seats.map((seat, i) => (
                  <div className="pb-3">{`Seat ${i + 1}`}</div>
                ))}
              </Col>
              <Col xs={9} className="tag-color-container">
                <div className="tag-color-row pb-3">
                  <LockIcon size={16} /> {user.username}
                </div>
                <SortableList onSortEnd={onSortEnd} items={editableRows} />
              </Col>
            </Row>
          </>
        )}
      </CardBody>
      <CardFooter>
        <Button color="success" block outline onClick={start} disabled={loading}>
          Start Draft
        </Button>
      </CardFooter>
    </Card>
  );
};

CubeDraft.propTypes = {
  draft: DraftPropType.isRequired,
  start: PropTypes.func.isRequired,
  socket: PropTypes.shape({
    on: PropTypes.func.isRequired,
  }).isRequired,
};

export default CubeDraft;
