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
  const [seats, setSeats] = React.useState({});
  const user = useContext(UserContext);

  const updateSeats = (s) => {
    setSeats(s);
    setLoading(false);
  };

  useMount(() => {
    const run = async () => {
      socket.on('players', async (data) => {
        console.log(data);
      });

      socket.on('seats', async (data) => {
        updateSeats(data);
      });

      await callApi('/multiplayer/initdraft', { draft: draft._id });

      const res = await callApi('/multiplayer/getdraftseats', { draft: draft._id });
      const json = await res.json();
      updateSeats(json.seats);
    };
    run();
  });

  const editableRows = draft.seats.map((seat, i) => {
    return {
      element: <div className="tag-color-row clickable pb-3">{<Username userId={seats[i]} /> || 'Bot'}</div>,
      key: i,
    };
  });

  const onSortEnd = ({ oldIndex, newIndex }) => {
    const newSeats = { ...seats };
    newSeats[oldIndex] = seats[newIndex];
    newSeats[newIndex] = seats[oldIndex];
    setSeats(newSeats);
  };

  if (user.id !== seats[0]) {
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
          {draft.seats.map((seat, i) => (
            <div className="pb-3">{`Seat ${i + 1}: ${seats[i] || 'Bot'}`}</div>
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
