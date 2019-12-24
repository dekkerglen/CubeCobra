import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Input, Row } from 'reactstrap';

import Draft from '../util/Draft';
import Location from '../util/DraftLocation';
import { arraysEqual, sortDeck } from '../util/Util';

import CSRFForm from './CSRFForm';
import DeckbuilderNavbar from './DeckbuilderNavbar';
import DeckStacks from './DeckStacks';
import { DisplayContextProvider } from './DisplayContext';
import DynamicFlash from './DynamicFlash';
import ErrorBoundary from './ErrorBoundary';

const canDrop = (source, target) => true;

const oppositeLocation = {
  [Location.DECK]: Location.SIDEBOARD,
  [Location.SIDEBOARD]: Location.DECK,
};

const makeInitialStacks = (playerDeck) => {
  if (playerDeck.length === 2 && Array.isArray(playerDeck[0]) && Array.isArray(playerDeck[0][0])) {
    // Already good.
    return playerDeck;
  } else if (playerDeck.length === 16) {
    // Already in stacks. Split into rows.
    return [playerDeck.slice(0, 8), playerDeck.slice(8, 16)];
  } else {
    return sortDeck(playerDeck);
  }
};

const Deckbuilder = ({ initialDeck, basics }) => {
  const [deck, setDeck] = useState(makeInitialStacks(initialDeck.playerdeck));
  const [sideboard, setSideboard] = useState(() => {
    const initial = initialDeck.playersideboard;
    if (!initial || !Array.isArray(initial) || initial.length === 0) {
      return [new Array(8).fill([])];
    } else {
      return [initialDeck.playersideboard.slice(0, 8)];
    }
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
    [deck, sideboard],
  );

  const handleClickCard = useCallback(
    (event) => {
      event.preventDefault();
      /* global */ autocard_hide_card();
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

  const addBasics = useCallback((numBasics) => {
    const addedLists = Object.entries(numBasics).map(([basic, count]) => new Array(count).fill(basics[basic]));
    const added = addedLists.flat();
    const newDeck = [...deck];
    newDeck[1][0] = [].concat(newDeck[1][0], added);
    setDeck(newDeck);
  }, [deck]);

  const currentDeck = { ...initialDeck };
  currentDeck.playerdeck = [...deck[0], ...deck[1]];
  currentDeck.playersideboard = sideboard[0];

  return (
    <DisplayContextProvider>
      <DeckbuilderNavbar deck={currentDeck} addBasics={addBasics} />
      <DynamicFlash />
      <ErrorBoundary>
        <DndProvider backend={HTML5Backend}>
          <DeckStacks
            className="mt-3"
            cards={deck}
            title="Deck"
            locationType={Location.DECK}
            canDrop={canDrop}
            onMoveCard={handleMoveCard}
            onClickCard={handleClickCard}
          />
          <DeckStacks
            className="mt-3"
            cards={sideboard}
            title="Sideboard"
            locationType={Location.SIDEBOARD}
            canDrop={canDrop}
            onMoveCard={handleMoveCard}
            onClickCard={handleClickCard}
          />
        </DndProvider>
      </ErrorBoundary>
    </DisplayContextProvider>
  );
};

Deckbuilder.propTypes = {
  initialDeck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    playerdeck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
    playersideboard: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)).isRequired,
  }).isRequired,
};

export default Deckbuilder;
