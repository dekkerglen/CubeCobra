import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import DeckPropType from 'proptypes/DeckPropType';
import UserPropType from 'proptypes/UserPropType';

import Location from 'utils/DraftLocation';
import { sortDeck } from 'utils/Util';

import { Card, CardHeader, CardBody, Row, Col, CardTitle } from 'reactstrap';

import DeckbuilderNavbar from 'components/DeckbuilderNavbar';
import DeckStacks from 'components/DeckStacks';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import DndProvider from 'components/DndProvider';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import TextEntry from 'components/TextEntry';
import CubeLayout from 'layouts/CubeLayout';
import { makeSubtitle } from 'utils/Card';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

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

const CubeDeckbuilderPage = ({ user, cube, initialDeck, basics, draft, loginCallback }) => {
  const [deck, setDeck] = useState(
    initialDeck.seats[0].deck.map((row) => row.map((col) => col.map((cardIndex) => initialDeck.cards[cardIndex]))),
  );
  const [sideboard, setSideboard] = useState(initialDeck.seats[0].sideboard.map((row) => row.map((col) => col.map((cardIndex) => initialDeck.cards[cardIndex]))));

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
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider>
          <DeckbuilderNavbar
            deck={currentDeck}
            addBasics={addBasics}
            name={name}
            description={description}
            className="mb-3"
            draft={draft}
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
  basics: PropTypes.objectOf(PropTypes.object).isRequired,
  cube: CubePropType.isRequired,
  initialDeck: DeckPropType.isRequired,
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))).isRequired,
  }).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeDeckbuilderPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeDeckbuilderPage);
