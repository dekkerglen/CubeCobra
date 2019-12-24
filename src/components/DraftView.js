import React, { useCallback, useState } from 'react';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Input, Row } from 'reactstrap';

import Draft from '../util/Draft';
import Location from '../util/DraftLocation';
import { arraysEqual, cmcColumn } from '../util/Util';

import CardStack from './CardStack';
import CSRFForm from './CSRFForm';
import DeckStacks from './DeckStacks';
import DraggableCard from './DraggableCard';
import ErrorBoundary from './ErrorBoundary';

const canDrop = (source, target) => {
  return target.type === Location.PICKS;
};

const Pack = ({ pack, packNumber, pickNumber, onMoveCard, onClickCard }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle>
        <h4>
          Pack {packNumber}, Pick {pickNumber}
        </h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      <Row noGutters>
        {pack.map((card, index) => (
          <Col key={card.details._id} xs={4} sm={3} className="col-md-1-5">
            <DraggableCard
              location={Location.pack(index)}
              data-index={index}
              card={card}
              canDrop={canDrop}
              onMoveCard={onMoveCard}
              onClick={onClickCard}
            />
          </Col>
        ))}
      </Row>
    </CardBody>
  </Card>
);

const DraftView = () => {
  const [pack, setPack] = useState(Draft.pack());
  const [initialPackNumber, initialPickNumber] = Draft.packPickNumber();
  const [packNumber, setPackNumber] = useState(initialPackNumber);
  const [pickNumber, setPickNumber] = useState(initialPickNumber);

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  const update = useCallback(() => {
    // This is very bad architecture. The React component should manage the state.
    // TODO: Move state inside React.
    let pack = Draft.pack();
    if (!Array.isArray(pack)) {
      pack = [];
    }
    setPack([...pack]);
    const [currentPackNumber, currentPickNumber] = Draft.packPickNumber();
    setPackNumber(currentPackNumber);
    setPickNumber(currentPickNumber);
  });

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) {
        return;
      }
      if (source.type === Location.PACK) {
        if (target.type === Location.PICKS) {
          setPicks(DeckStacks.moveOrAddCard(picks, target.data, pack[source.data]));
          await Draft.pick(source.data);
          update();
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === Location.PICKS) {
        if (target.type === Location.PICKS) {
          setPicks(DeckStacks.moveOrAddCard(picks, target.data, source.data));
          update();
        } else {
          console.error("Can't move cards from picks back to pack.");
        }
      }
    },
    [pack, picks],
  );

  const handleClickCard = useCallback(
    async (event) => {
      event.preventDefault();
      /* global */ autocard_hide_card();
      const target = event.currentTarget;
      const cardIndex = parseInt(target.getAttribute('data-index'));
      const card = pack[cardIndex];
      const typeLine = (card.type_line || card.details.type).toLowerCase();
      const row = typeLine.includes('creature') ? 0 : 1;
      const col = cmcColumn(card);
      const colIndex = picks[row][col].length;
      setPicks(DeckStacks.moveOrAddCard(picks, [row, col, colIndex], card));
      await Draft.pick(cardIndex);
      update();
    },
    [pack, picks],
  );

  return (
    <ErrorBoundary>
      <CSRFForm className="d-none" id="submitDeckForm" method="POST" action={`/cube/submitdeck/${Draft.cube()}`}>
        <Input type="hidden" name="body" value={Draft.id()} />
      </CSRFForm>
      <DndProvider backend={HTML5Backend}>
        <Pack
          pack={pack}
          packNumber={packNumber}
          pickNumber={pickNumber}
          onMoveCard={handleMoveCard}
          onClickCard={handleClickCard}
        />
        <DeckStacks
          cards={picks}
          title="Picks"
          locationType={Location.PICKS}
          canDrop={canDrop}
          onMoveCard={handleMoveCard}
          className="mt-3"
        />
      </DndProvider>
    </ErrorBoundary>
  );
};

DraftView.propTypes = {};

export default DraftView;
