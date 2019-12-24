import React, { useCallback, useState } from 'react';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Input, Row } from 'reactstrap';

import Draft from '../util/Draft';
import Location from '../util/DraftLocation';
import { arraysEqual } from '../util/Util';

import CSRFForm from './CSRFForm';
import DeckbuilderNavbar from './DeckbuilderNavbar';
import DeckStacks from './DeckStacks';
import DynamicFlash from './DynamicFlash';
import ErrorBoundary from './ErrorBoundary';

const canDrop = (source, target) => true;

/* FIXME: use arrangement of cards from the draft */
const sortInitialDeck = (initialDeck) => {
  const result = [new Array(8).fill([]), new Array(8).fill([])];
  for (const column of initialDeck.playerdeck) {
    for (const card of column) {
      const typeLine = (card.type_line || card.details.type).toLowerCase();
      const row = typeLine.includes('creature') ? 0 : 1;
      const cmcColumn = DeckStacks.cmcColumn(card);
      if (result[row][cmcColumn].length === 0) {
        result[row][cmcColumn] = [card];
      } else {
        result[row][cmcColumn].push(card);
      }
    }
  }
  return result;
};

const oppositeLocation = {
  [Location.DECK]: Location.SIDEBOARD,
  [Location.SIDEBOARD]: Location.DECK,
};

const Deckbuilder = ({ initialDeck }) => {
  const [deck, setDeck] = useState([initialDeck.playerdeck.slice(0, 8), initialDeck.playerdeck.slice(8, 16)]);
  const [sideboard, setSideboard] = useState([initialDeck.playersideboard.slice(0, 8)]);

  const locationMap = {
    [Location.DECK]: [deck, setDeck],
    [Location.SIDEBOARD]: [sideboard, setSideboard],
  };

  const handleMoveCard = useCallback((source, target) => {
    if (source.equals(target)) {
      return;
    }

    const [sourceCards, setSource] = locationMap[source.type];
    const [targetCards, setTarget] = locationMap[target.type];

    const [card, newSourceCards] = DeckStacks.removeCard(sourceCards, source.data);
    setSource(newSourceCards);
    setTarget(DeckStacks.moveOrAddCard(targetCards, target.data, card));
  }, [deck, sideboard]);

  const handleClickCard = useCallback((event) => {
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
  }, [handleMoveCard]);

  const currentDeck = { ...initialDeck };
  currentDeck.playerdeck = [...deck[0], ...deck[1]];
  currentDeck.playersideboard = sideboard[0];

  return (
    <ErrorBoundary>
      <DeckbuilderNavbar deck={currentDeck} />
      <DndProvider backend={HTML5Backend}>
        <DeckStacks className="mt-3" cards={deck} title="Deck" locationType={Location.DECK} canDrop={canDrop} onMoveCard={handleMoveCard} onClickCard={handleClickCard} />
        <DeckStacks className="mt-3" cards={sideboard} title="Sideboard" locationType={Location.SIDEBOARD} canDrop={canDrop} onMoveCard={handleMoveCard} onClickCard={handleClickCard} />
      </DndProvider>
    </ErrorBoundary>
  );
}

Deckbuilder.propTypes = {};

export default Deckbuilder;
