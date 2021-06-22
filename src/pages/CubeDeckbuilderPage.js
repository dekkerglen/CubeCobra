import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardHeader, CardBody, Row, Col, CardTitle } from 'reactstrap';

import DeckbuilderNavbar from 'components/DeckbuilderNavbar';
import DeckStacks from 'components/DeckStacks';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import DndProvider from 'components/DndProvider';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import TextEntry from 'components/TextEntry';
import DraftLocation, { moveOrAddCard, removeCard } from 'drafting/DraftLocation';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';
import { makeSubtitle } from 'utils/Card';
import RenderToRoot from 'utils/RenderToRoot';

const canDrop = () => true;

const oppositeLocation = {
  [DraftLocation.DECK]: DraftLocation.SIDEBOARD,
  [DraftLocation.SIDEBOARD]: DraftLocation.DECK,
};

const CubeDeckbuilderPage = ({ cube, initialDeck, loginCallback }) => {
  const { basics } = initialDeck;
  const [deck, setDeck] = useState(
    initialDeck.seats[0].deck.map((row) => row.map((col) => col.map((cardIndex) => initialDeck.cards[cardIndex]))),
  );
  const [sideboard, setSideboard] = useState(
    initialDeck.seats[0].sideboard.map((row) => row.map((col) => col.map((cardIndex) => initialDeck.cards[cardIndex]))),
  );

  const locationMap = {
    [DraftLocation.DECK]: [deck, setDeck],
    [DraftLocation.SIDEBOARD]: [sideboard, setSideboard],
  };

  const handleMoveCard = useCallback(
    (source, target) => {
      if (source.equals(target)) {
        return;
      }

      if (source.type === target.type) {
        const [cards, setSource] = locationMap[source.type];

        setSource(moveOrAddCard(cards, target.data, source.data));
      } else {
        const [sourceCards, setSource] = locationMap[source.type];
        const [targetCards, setTarget] = locationMap[target.type];

        const [card, newSourceCards] = removeCard(sourceCards, source.data);
        setSource(newSourceCards);
        setTarget(moveOrAddCard(targetCards, target.data, card));
      }
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
      const source = new DraftLocation(locationType, locationData);
      const target = new DraftLocation(oppositeLocation[source.type], [...source.data]);
      target.data[2] = 0;
      if (target.type === DraftLocation.SIDEBOARD) {
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
      const toAdd = numBasics.map((count, index) => new Array(count).fill(initialDeck.cards[basics[index]])).flat();
      const newDeck = [...deck];
      newDeck[1][0] = [].concat(newDeck[1][0], toAdd);
      setDeck(newDeck);
    },
    [deck, basics, initialDeck],
  );

  const currentDeck = { ...initialDeck };
  currentDeck.playerdeck = deck;
  currentDeck.playersideboard = sideboard;

  const [name, setName] = useState(initialDeck.seats[0].name);
  const [description, setDescription] = useState(initialDeck.seats[0].description);

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider cubeID={cube._id}>
          <DeckbuilderNavbar
            deck={currentDeck}
            addBasics={addBasics}
            name={name}
            description={description}
            className="mb-3"
            setDeck={setDeck}
            setSideboard={setSideboard}
            cards={initialDeck.cards}
          />
          <DynamicFlash />
          <Row className="mb-3">
            <Col>
              <Card>
                <ErrorBoundary>
                  <DndProvider>
                    <DeckStacks
                      cards={deck}
                      title="Deck"
                      subtitle={makeSubtitle(deck.flat().flat())}
                      locationType={DraftLocation.DECK}
                      canDrop={canDrop}
                      onMoveCard={handleMoveCard}
                      onClickCard={handleClickCard}
                    />
                    <DeckStacks
                      className="border-top"
                      cards={sideboard}
                      title="Sideboard"
                      locationType={DraftLocation.SIDEBOARD}
                      canDrop={canDrop}
                      onMoveCard={handleMoveCard}
                      onClickCard={handleClickCard}
                    />
                  </DndProvider>
                </ErrorBoundary>
                <CardHeader className="border-top">
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
    </MainLayout>
  );
};
CubeDeckbuilderPage.propTypes = {
  cube: CubePropType.isRequired,
  initialDeck: DeckPropType.isRequired,
  loginCallback: PropTypes.string,
};
CubeDeckbuilderPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeDeckbuilderPage);
