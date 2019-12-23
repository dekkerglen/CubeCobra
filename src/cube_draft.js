import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Row } from 'reactstrap';

import { arraysEqual } from './util/Util';

import CardStack from './components/CardStack';
import DraggableCard from './components/DraggableCard';

class Location {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }

  static pack(data) {
    return new Location(Location.PACK, data);
  }

  static picks(data) {
    return new Location(Location.PICKS, data);
  }

  equals(other) {
    if (this.type !== other.type) {
      return false;
    }

    if (Array.isArray(this.data) && Array.isArray(other.data)) {
      return arraysEqual(this.data, other.data);
    }

    return this.data === other.data;
  }

  toString() {
    return `Location.${this.type}(${this.data})`;
  }
}
Location.PACK = 'pack';
Location.PICKS = 'picks';

const canDrop = (source, target) => {
  return target.type === Location.PICKS;
}

const CubeDraft = ({ initialDraft }) => {
  const initialPicks = Object.fromEntries(initialDraft.picks[0].map((card, index) => 
    [Location.pack(index).toString(), card]
  ))
  const [pack, setPack] = useState(initialDraft.packs[0][0]);
  const [userPicks, setUserPicks] = useState(initialDraft.picks[0]);
  const [packNumber, setPackNumber] = useState(initialDraft.packNumber);
  const [pickNumber, setPickNumber] = useState(initialDraft.pickNumber);

  const handleMoveCard = useCallback((source, target) => {
    if (source.type === Location.PACK) {
      if (target.type === Location.PICKS) {
      } else {
        console.error('Can\'t move cards inside pack.');
      }
    } else if (source.type === Location.PICKS) {
      if (target.type === Location.PICKS) {
        console.log('move');
      } else {
        console.error('Can\'t move cards from picks back to pack.');
      }
    }
  });

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
                card={card}
                canDrop={canDrop}
                onMoveCard={handleMoveCard}
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
          <Row>
            <CardStack location={Location.picks([0, 0])}>
              <DraggableCard
                location={Location.picks([0, 1])}
                card={draft.packs[0][0][0]}
                canDrop={canDrop}
                onMoveCard={handleMoveCard}
              />
            </CardStack>
            <CardStack location={Location.picks([1, 0])} style={{ width: '200px' }}/>
          </Row>
        </CardBody>
      </Card>
    </DndProvider>
  );
}

const draft = JSON.parse(document.getElementById("draftraw").value);
const element = <CubeDraft initialDraft={draft} />;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
