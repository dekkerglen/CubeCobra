import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Row } from 'reactstrap';

import Draft from './util/Draft';
import Location from './util/DraftLocation';
import { arraysEqual } from './util/Util';

import CardStack from './components/CardStack';
import DraggableCard from './components/DraggableCard';

const canDrop = (source, target) => {
  return target.type === Location.PICKS;
}

const CubeDraft = ({ initialDraft }) => {
  const [pack, setPack] = useState(Draft.pack());
  const [initialPackNumber, initialPickNumber] = Draft.packPickNumber();
  const [packNumber, setPackNumber] = useState(initialPackNumber);
  const [pickNumber, setPickNumber] = useState(initialPickNumber);

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([[], []]);

  const update = useCallback(() => {
    setPack(Draft.pack());
    const [currentPackNumber, currentPickNumber] = Draft.packPickNumber();
    setPackNumber(currentPackNumber);
    setPickNumber(currentPickNumber);
  });

  const handleMoveCard = useCallback((source, target) => {
    if (source.equals(target)) {
      return;
    }
    if (source.type === Location.PACK) {
      if (target.type === Location.PICKS) {
        const card = pack[source.data];
        const [row, col, index] = target.data;
        const newPicks = [...picks];
        if (newPicks[row].length < col) {
          newPicks[row] = newPicks[row].concat(Array(1 + col - newPicks[row].length).fill([]));
        }
        newPicks[row][col] = [...newPicks[row][col]];
        newPicks[row][col].splice(index, 0, card);
        setPicks(newPicks);
        Draft.pick(source.data);
        update();
      } else {
        console.error('Can\'t move cards inside pack.');
      }
    } else if (source.type === Location.PICKS) {
      if (target.type === Location.PICKS) {
        const [sourceRow, sourceCol, sourceIndex] = source.data;
        const [targetRow, targetCol, targetIndex] = target.data;
        const newPicks = [...picks];
        if (newPicks[targetRow].length < targetCol) {
          newPicks[targetRow] = newPicks[targetRow].concat(1 + Array(col - newPicks[row].length).fill([]));
        }
        newPicks[sourceRow][sourceCol] = [...newPicks[sourceRow][soureCol]];
        newPicks[targetRow][targetCol] = [...newPicks[targetRow][soureCol]];
        const [card] = newPicks[sourceRow][sourceCol].splice(sourceIndex, 1);
        newPicks[targetRow][targetCol].splice(targetIndex, 0, card);
        setPicks(newPicks);
        update();
      } else {
        console.error('Can\'t move cards from picks back to pack.');
      }
    }
  }, [pack, picks]);

  const handleClickCard = useCallback((event) => {
    event.preventDefault();
    /* global */ autocard_hide_card();
    const target = event.currentTarget;
    const cardIndex = parseInt(target.getAttribute('data-index'));
    const card = pack[cardIndex];
    const typeLine = (card.type_line || card.details.type).toLowerCase();
    const row = typeLine.includes('creature') ? 0 : 1;
    const col = parseInt(card.cmc || card.details.cmc) || 0;
    const newPicks = [...picks];
    if (newPicks[row].length < 1 + col) {
      newPicks[row] = newPicks[row].concat(Array(1 + col - newPicks[row].length).fill([]));
    }
    const colIndex = newPicks[row][col].length;
    newPicks[row][col] = [...newPicks[row][col]];
    newPicks[row][col].splice(colIndex, 0, card);
    setPicks(newPicks);
    Draft.pick(cardIndex);
  }, [pack, picks]);

  return (
    <DndProvider backend={HTML5Backend}>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            <h4>Pack {packNumber}, Pick {pickNumber}</h4>
          </CardTitle>
        </CardHeader>
        <CardBody>
          <Row>
            {pack.map((card, index) =>
              <DraggableCard
                key={index}
                location={Location.pack(index)}
                data-index={index}
                card={card}
                canDrop={canDrop}
                onMoveCard={handleMoveCard}
                onClick={handleClickCard}
              />
            )}
          </Row>
        </CardBody>
      </Card>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            <h4>Picks</h4>
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {picks.map((row, index) =>
            <Row key={index}>
              {row.map((column, index2) =>
                <CardStack key={index2} location={Location.picks([index, index2, 0])}>
                  {column.map((card, index3) =>
                    <DraggableCard
                      key={card.details.name}
                      location={Location.picks([index, index2, index3 + 1])}
                      card={card}
                      canDrop={canDrop}
                      onMoveCard={handleMoveCard}
                    />
                  )}
                </CardStack>
              )}
            </Row>
          )}
        </CardBody>
      </Card>
    </DndProvider>
  );
}

const draft = JSON.parse(document.getElementById("draftraw").value);
Draft.init(draft);
const element = <CubeDraft />;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
