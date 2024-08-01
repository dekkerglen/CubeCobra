import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Card, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';

import DeckbuilderNavbar from 'components/DeckbuilderNavbar';
import DeckStacks from 'components/DeckStacks';
import DndProvider from 'components/DndProvider';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import UserContext from 'contexts/UserContext';
import DraftLocation, { moveOrAddCard, removeCard } from 'drafting/DraftLocation';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { makeSubtitle } from 'utils/Card';
import RenderToRoot from 'utils/RenderToRoot';

const canDrop = () => true;

const getMatchingSeat = (seats, userid) =>
  seats.map((seat, index) => [seat, index]).find((tuple) => tuple[0].owner.id === userid)[1];

const CubeDeckbuilderPage = ({ cube, initialDeck, loginCallback }) => {
  const user = useContext(UserContext);
  const [seat] = useState(getMatchingSeat(initialDeck.seats, user.id));
  const [deck, setDeck] = useState(
    initialDeck.seats[seat].mainboard.map((row) =>
      row.map((col) => col.map((cardIndex) => initialDeck.cards[cardIndex])),
    ),
  );
  const [sideboard, setSideboard] = useState(
    initialDeck.seats[seat].sideboard.map((row) =>
      row.map((col) => col.map((cardIndex) => initialDeck.cards[cardIndex])),
    ),
  );

  const { basics } = initialDeck;

  const locationMap = useMemo(
    () => ({
      [DraftLocation.DECK]: [deck, setDeck],
      [DraftLocation.SIDEBOARD]: [sideboard, setSideboard],
    }),
    [deck, setDeck, sideboard, setSideboard],
  );

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
  currentDeck.mainboard = deck;
  currentDeck.sideboard = sideboard;

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <DeckbuilderNavbar
            deck={currentDeck}
            addBasics={addBasics}
            name={initialDeck.seats[seat].name}
            description={initialDeck.seats[seat].description}
            className="mb-3"
            setDeck={setDeck}
            setSideboard={setSideboard}
            cards={initialDeck.cards}
            seat={seat}
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
                      onClickCard={handleMoveCard}
                    />
                    <DeckStacks
                      className="border-top"
                      cards={sideboard}
                      title="Sideboard"
                      locationType={DraftLocation.SIDEBOARD}
                      canDrop={canDrop}
                      onMoveCard={handleMoveCard}
                      onClickCard={handleMoveCard}
                    />
                  </DndProvider>
                </ErrorBoundary>
              </Card>
            </Col>
          </Row>
        </CubeLayout>
      </DisplayContextProvider>
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
