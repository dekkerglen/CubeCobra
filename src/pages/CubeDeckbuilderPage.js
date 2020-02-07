import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import Location from 'utils/DraftLocation';
import { sortDeck } from 'utils/Util';

import { Card, CardHeader, CardBody, Row, Col, CardTitle } from 'reactstrap';

import DeckbuilderNavbar from 'components/DeckbuilderNavbar';
import DeckStacks from 'components/DeckStacks';
import { DisplayContextProvider } from 'components/DisplayContext';
import DndProvider from 'components/DndProvider';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import TextEntry from 'components/TextEntry';
import CubeLayout from 'layouts/CubeLayout';
import { subtitle } from 'pages/CubeDraftPage';

const canDrop = () => true;

const oppositeLocation = {
  [Location.DECK]: Location.SIDEBOARD,
  [Location.SIDEBOARD]: Location.DECK,
};

const makeInitialStacks = (playerDeck) => {
  if (playerDeck.length === 2 && Array.isArray(playerDeck[0]) && Array.isArray(playerDeck[0][0])) {
    // Already good.
    return playerDeck;
  }
  if (playerDeck.length === 16) {
    // Already in stacks. Split into rows.
    return [playerDeck.slice(0, 8), playerDeck.slice(8, 16)];
  }
  return sortDeck(playerDeck);
};

const CubeDeckbuilderPage = ({ cube, cubeID, initialDeck, basics }) => {
  const [deck, setDeck] = useState(makeInitialStacks(initialDeck.seats[0].deck));
  const [sideboard, setSideboard] = useState(() => {
    const initial = initialDeck.seats[0].sideboard;
    if (!initial || !Array.isArray(initial) || initial.length === 0) {
      return [new Array(8).fill([])];
    }
    return [initialDeck.seats[0].sideboard.slice(0, 8)];
  });

  const locationMap = {
    [Location.DECK]: [deck, setDeck],
    [Location.SIDEBOARD]: [sideboard, setSideboard],
  };

  const handleMoveCard = useCallback(
    (source, target) => {
      if (source.equals(target)) {
        return;
      }

      const [sourceCards, setSource] = locationMap[source.type];
      const [targetCards, setTarget] = locationMap[target.type];

      const [card, newSourceCards] = DeckStacks.removeCard(sourceCards, source.data);
      setSource(newSourceCards);
      setTarget(DeckStacks.moveOrAddCard(targetCards, target.data, card));
    },
    [locationMap],
  );

  const handleClickCard = useCallback(
    (event) => {
      event.preventDefault();
      /* eslint-disable-line no-undef */ autocard_hide_card();
      const eventTarget = event.currentTarget;
      const locationType = eventTarget.getAttribute('data-location-type');
      const locationData = JSON.parse(eventTarget.getAttribute('data-location-data'));
      const source = new Location(locationType, locationData);
      const target = new Location(oppositeLocation[source.type], [...source.data]);
      target.data[2] = 0;
      if (target.type === Location.SIDEBOARD) {
        // Only one row for the sideboard.
        target.data[0] = 0;
      } else {
        // Pick row based on CNC.
        target.data[0] = eventTarget.getAttribute('data-cnc') === 'true' ? 0 : 1;
      }
      handleMoveCard(source, target);
    },
    [handleMoveCard],
  );

  const addBasics = useCallback(
    (numBasics) => {
      const addedLists = Object.entries(numBasics).map(([basic, count]) => new Array(count).fill(basics[basic]));
      const added = addedLists.flat();
      const newDeck = [...deck];
      newDeck[1][0] = [].concat(newDeck[1][0], added);
      setDeck(newDeck);
    },
    [deck, basics],
  );

  const currentDeck = { ...initialDeck };
  currentDeck.playerdeck = [...deck[0], ...deck[1]];
  [currentDeck.playersideboard] = sideboard;

  const [name, setName] = useState(initialDeck.seats[0].name);
  const [description, setDescription] = useState(initialDeck.seats[0].description);

  return (
    <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
      <DisplayContextProvider>
        <DeckbuilderNavbar
          deck={currentDeck}
          addBasics={addBasics}
          name={name}
          description={description}
          className="mb-3"
        />
        <DynamicFlash />
        <Row>
          <Col>          
            <Card>
              <ErrorBoundary>
                <DndProvider>
                  <DeckStacks
                    cards={deck}
                    title="Deck"
                    subtitle={subtitle(deck.flat().flat())}
                    locationType={Location.DECK}
                    canDrop={canDrop}
                    onMoveCard={handleMoveCard}
                    onClickCard={handleClickCard}
                  />
                  <DeckStacks
                    className="border-top"
                    cards={sideboard}
                    title="Sideboard"
                    locationType={Location.SIDEBOARD}
                    canDrop={canDrop}
                    onMoveCard={handleMoveCard}
                    onClickCard={handleClickCard}
                  />
                </DndProvider>
              </ErrorBoundary>
              <CardHeader className='border-top'>
                <CardTitle className="mb-0 d-flex flex-row align-items-end">
                  <h4 className="mb-0 mr-auto">About</h4>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <h6>Deck Name</h6>
                <input
                  className="form-control"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <br />

                <h6>Description</h6>
                <TextEntry value={description} onChange={(e) => setDescription(e.target.value)} />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </DisplayContextProvider>
    </CubeLayout>
  );
};

CubeDeckbuilderPage.propTypes = {
  basics: PropTypes.objectOf(PropTypes.object).isRequired,
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDeck: PropTypes.object.isRequired,
};

export default CubeDeckbuilderPage;
