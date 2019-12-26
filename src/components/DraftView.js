import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Collapse, Input, Nav, Navbar, Row, Spinner } from 'reactstrap';

import Draft from '../util/Draft';
import Location from '../util/DraftLocation';
import { cmcColumn } from '../util/Util';

import CSRFForm from './CSRFForm';
import CustomImageToggler from './CustomImageToggler';
import DeckStacks from './DeckStacks';
import { DisplayContextProvider } from './DisplayContext';
import DraggableCard from './DraggableCard';
import ErrorBoundary from './ErrorBoundary';

const canDrop = (source, target) => {
  return target.type === Location.PICKS;
};

const Pack = ({ pack, packNumber, pickNumber, picking, onMoveCard, onClickCard }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">
          Pack {packNumber}, Pick {pickNumber}
        </h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      <Row noGutters>
        {pack.map((card, index) => (
          <Col
            key={card.details._id}
            xs={4}
            sm={3}
            className="col-md-1-5 d-flex justify-content-center align-items-center"
          >
            {picking !== index ? false : <Spinner className="position-absolute" />}
            <DraggableCard
              location={Location.pack(index)}
              data-index={index}
              card={card}
              canDrop={canDrop}
              onMoveCard={picking === null ? onMoveCard : undefined}
              onClick={picking === null ? onClickCard : undefined}
              className={picking === index ? 'transparent' : undefined}
            />
          </Col>
        ))}
      </Row>
    </CardBody>
  </Card>
);

Pack.propTypes = {
  pack: PropTypes.arrayOf(PropTypes.object).isRequired,
  packNumber: PropTypes.number.isRequired,
  pickNumber: PropTypes.number.isRequired,
  picking: PropTypes.number,
  onMoveCard: PropTypes.func.isRequired,
  onClickCard: PropTypes.func.isRequired,
};

Pack.defaultProps = {
  picking: null,
};

const DraftView = () => {
  const [pack, setPack] = useState([...Draft.pack()]);
  const [initialPackNumber, initialPickNumber] = Draft.packPickNumber();
  const [packNumber, setPackNumber] = useState(initialPackNumber);
  const [pickNumber, setPickNumber] = useState(initialPickNumber);

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  // State for showing loading while waiting for next pick.
  const [picking, setPicking] = useState(null);

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
    Draft.arrangePicks([].concat(picks[0], picks[1]));
  }, [picks]);

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) {
        return;
      }
      if (source.type === Location.PACK) {
        if (target.type === Location.PICKS) {
          await Draft.pick(source.data);
          setPicks(DeckStacks.moveOrAddCard(picks, target.data, pack[source.data]));
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
      setPicking(cardIndex);
      await Draft.pick(cardIndex);
      setPicking(null);
      setPicks(DeckStacks.moveOrAddCard(picks, [row, col, colIndex], card));
      update();
    },
    [pack, picks],
  );

  const allCards = picks.flat().flat();
  const allTypes = allCards.map((card) => (card.type_line || card.details.type).toLowerCase());
  const numCreatures = allTypes.filter((type) => type.includes('creature')).length;
  const numLands = allTypes.filter((type) => type.includes('land')).length;
  const numOther = allCards.length - numLands - numCreatures;
  const subtitle =
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numCreatures} creature${numCreatures === 1 ? '' : 's'}, ` +
    `${numOther} other`;

  return (
    <DisplayContextProvider>
      <div className="usercontrols">
        <Navbar expand="xs" light>
          <Collapse navbar>
            <Nav navbar>
              <CustomImageToggler />
            </Nav>
          </Collapse>
        </Navbar>
      </div>
      <CSRFForm className="d-none" id="submitDeckForm" method="POST" action={`/cube/submitdeck/${Draft.cube()}`}>
        <Input type="hidden" name="body" value={Draft.id()} />
      </CSRFForm>
      <DndProvider backend={HTML5Backend}>
        <ErrorBoundary>
          <Pack
            pack={pack}
            packNumber={packNumber}
            pickNumber={pickNumber}
            picking={picking}
            onMoveCard={handleMoveCard}
            onClickCard={handleClickCard}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <DeckStacks
            cards={picks}
            title="Picks"
            subtitle={subtitle}
            locationType={Location.PICKS}
            canDrop={canDrop}
            onMoveCard={handleMoveCard}
            className="mt-3"
          />
        </ErrorBoundary>
      </DndProvider>
    </DisplayContextProvider>
  );
};

DraftView.propTypes = {};

export default DraftView;
