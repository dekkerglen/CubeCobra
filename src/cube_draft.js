import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Row } from 'reactstrap';

import Draft from './util/Draft';
import Location from './util/DraftLocation';
import { arraysEqual } from './util/Util';

import CardStack from './components/CardStack';
import DraggableCard from './components/DraggableCard';

const cmcToNumber = (card) => {
  let cmc = card.hasOwnProperty('cmc') ? card.cmc : card.details.cmc;
  if (isNaN(cmc)) {
    cmc = cmc.indexOf('.') > -1 ? parseFloat(cmc) : parseInt(cmc);
  }
  // Round to half-integer then take ceiling to support Little Girl
  let cmcDoubleInt = Math.round(cmc * 2);
  let cmcInt = Math.round((cmcDoubleInt + cmcDoubleInt % 2) / 2);
  if (cmcInt < 0) {
    cmcInt = 0;
  }
  if (cmcInt > 7) {
    cmcInt = 7;
  }
};

const canDrop = (source, target) => {
  return target.type === Location.PICKS;
};

const CubeDraft = ({ initialDraft }) => {
  const [pack, setPack] = useState(Draft.pack());
  const [initialPackNumber, initialPickNumber] = Draft.packPickNumber();
  const [packNumber, setPackNumber] = useState(initialPackNumber);
  const [pickNumber, setPickNumber] = useState(initialPickNumber);

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  const update = useCallback(() => {
    // This is very bad architecture. The React component should manage the state.
    // TODO: Move state inside React.
    setPack([...Draft.pack()]);
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
        if (newPicks[row].length < 1 + col) {
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
        if (newPicks[targetRow].length < 1 + targetCol) {
          newPicks[targetRow] = newPicks[targetRow].concat(Array(1 + targetCol - newPicks[targetRow].length).fill([]));
        }
        newPicks[sourceRow][sourceCol] = [...newPicks[sourceRow][sourceCol]];
        newPicks[targetRow][targetCol] = [...newPicks[targetRow][targetCol]];
        const [card] = newPicks[sourceRow][sourceCol].splice(sourceIndex - 1, 1);
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
    update();
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
          <Row noGutters>
            {pack.map((card, index) =>
              <Col key={card.details._id} xs={4} sm={3} className="col-md-1-5">
                <DraggableCard
                  location={Location.pack(index)}
                  data-index={index}
                  card={card}
                  canDrop={canDrop}
                  onMoveCard={handleMoveCard}
                  onClick={handleClickCard}
                />
              </Col>
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
            <Row key={index} className="draft-row">
              {row.map((column, index2) =>
                <CardStack key={index2} location={Location.picks([index, index2, 0])}>
                  {column.map((card, index3) =>
                    <div className="stacked" key={card.details._id}>
                      <DraggableCard
                        location={Location.picks([index, index2, index3 + 1])}
                        card={card}
                        canDrop={canDrop}
                        onMoveCard={handleMoveCard}
                      />
                    </div>
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
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeDraft />, wrapper) : false;
