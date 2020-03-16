import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import openSocket from 'socket.io-client';

import { Card, CardBody, CardHeader, CardTitle, Col, Collapse, Nav, Navbar, Row, Spinner } from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';
import Location from 'utils/DraftLocation';
import { cmcColumn } from 'utils/Util';

import CustomImageToggler from 'components/CustomImageToggler';
import DeckStacks from 'components/DeckStacks';
import { DisplayContextProvider } from 'components/DisplayContext';
import DndProvider from 'components/DndProvider';
import DraggableCard from 'components/DraggableCard';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import CubeLayout from 'layouts/CubeLayout';

export const subtitle = (cards) => {
  const numCards = cards.length;
  const allTypes = cards.map((card) => (card.type_line || card.details.type).toLowerCase());
  const numLands = allTypes.filter((type) => type.includes('land')).length;
  const numNonlands = allTypes.filter(
    (type) => !type.includes('land') && !/^(plane|phenomenon|vanguard|scheme|conspiracy)$/.test(type),
  ).length;
  const numCreatures = allTypes.filter((type) => type.includes('creature')).length;
  const numNonCreatures = numNonlands - numCreatures;
  return (
    `${numCards} card${numCards === 1 ? '' : 's'}: ` +
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numNonlands} nonland: ` +
    `${numCreatures} creature${numCreatures === 1 ? '' : 's'}, ` +
    `${numNonCreatures} noncreature${numNonCreatures === 1 ? '' : 's'}`
  );
};

const canDrop = (source, target) => {
  return target.type === Location.PICKS;
};

const Pack = ({ pack, title, picking, onMoveCard, onClickCard }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">{title}</h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      <Row noGutters>
        {pack.map((card, index) => (
          <Col
            key={/* eslint-disable-line react/no-array-index-key */ `${title}:${index}`}
            xs={3}
            className="col-md-1-5 d-flex justify-content-center align-items-center"
          >
            {picking !== index ? false : <Spinner className="position-absolute" />}
            <DraggableCard
              location={Location.pack(index)}
              data-index={index}
              card={card}
              canDrop={canDrop}
              onMoveCard={picking === null ? onMoveCard : undefined}
              onClick={picking === null ? onClickCard : undefined}
              className={picking === index ? 'transparent' : undefined}
            />
          </Col>
        ))}
      </Row>
    </CardBody>
  </Card>
);

Pack.propTypes = {
  pack: PropTypes.arrayOf(PropTypes.object).isRequired,
  title: PropTypes.string.isRequired,
  picking: PropTypes.number,
  onMoveCard: PropTypes.func.isRequired,
  onClickCard: PropTypes.func.isRequired,
};

Pack.defaultProps = {
  picking: null,
};

let connection = null;

const connect = (draftID) => {
  if (!connection) {
    connection = openSocket('http://localhost:8080');

    console.log('connecting');

    connection.emit('register', draftID);
  }
  return connection;
};

const CubeDraftPage = ({ cube, cubeID, initialPack, draftID }) => {
  console.log(initialPack);
  const [pack, setPack] = useState(initialPack);
  const [packNumber, setPackNumber] = useState(0);
  const [pickNumber, setPickNumber] = useState(0);
  const [socket, setSocket] = useState(connect(draftID));

  socket.on('update', (update) => {
    console.log(update);
  });

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  // State for showing loading while waiting for next pick.
  const [picking, setPicking] = useState(null);
  const [finished, setFinished] = useState(false);

  const makePick = useCallback(
    async (pickIndex) => {
      console.log(pickIndex);

      setPicking(pickIndex);
      // TODO:grab new pack here

      const response = await csrfFetch(`/draft/pick/${draftID}/0/${pickIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((err) => console.error(err));

      setPackNumber(0);
      setPickNumber(0);

      setPack([]);
      setPicking(null);
    },
    [draftID],
  );

  useEffect(() => {
    (async () => {
      if (finished) {
        // TODO: submit draft
        console.log('finished');
      }
    })();
  }, [finished]);

  socket.on('FromAPI', (data) => this.setState({ response: data }));

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) {
        return;
      }
      if (source.type === Location.PACK) {
        if (target.type === Location.PICKS) {
          const newPicks = DeckStacks.moveOrAddCard(picks, target.data, pack[source.data]);
          await makePick(source.data);
          setPicks(newPicks);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === Location.PICKS) {
        if (target.type === Location.PICKS) {
          const newPicks = DeckStacks.moveOrAddCard(picks, target.data, source.data);
          setPicks(newPicks);
        } else {
          console.error("Can't move cards from picks back to pack.");
        }
      }
    },
    [makePick, pack, picks],
  );

  const handleClickCard = useCallback(
    async (event) => {
      event.preventDefault();
      /* eslint-disable-line no-undef */ autocard_hide_card();
      const target = event.currentTarget;
      const cardIndex = parseInt(target.getAttribute('data-index'), 10);
      const card = pack[cardIndex];
      const typeLine = (card.type_line || card.details.type).toLowerCase();
      const row = typeLine.includes('creature') ? 0 : 1;
      const col = cmcColumn(card);
      const colIndex = picks[row][col].length;
      const newPicks = DeckStacks.moveOrAddCard(picks, [row, col, colIndex], card);
      await makePick(cardIndex);
      setPicks(newPicks);
    },
    [makePick, pack, picks],
  );
  return (
    <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
      <DisplayContextProvider>
        <Navbar expand="xs" light className="usercontrols">
          <Collapse navbar>
            <Nav navbar>
              <CustomImageToggler />
            </Nav>
          </Collapse>
        </Navbar>
        <DynamicFlash />
        <DndProvider>
          <ErrorBoundary>
            <Pack
              pack={pack}
              title={pack.length > 0 ? `Pack ${packNumber} - Pack ${pickNumber}` : 'Waiting for next pack...'}
              picking={picking}
              onMoveCard={handleMoveCard}
              onClickCard={handleClickCard}
            />
          </ErrorBoundary>
          <ErrorBoundary className="mt-3">
            <Card className="mt-3">
              <DeckStacks
                cards={picks}
                title="Picks"
                subtitle={subtitle(picks.flat().flat())}
                locationType={Location.PICKS}
                canDrop={canDrop}
                onMoveCard={handleMoveCard}
              />
            </Card>
          </ErrorBoundary>
        </DndProvider>
      </DisplayContextProvider>
    </CubeLayout>
  );
};

CubeDraftPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  draftID: PropTypes.string.isRequired,
  initialPack: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default CubeDraftPage;
