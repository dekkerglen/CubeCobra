import React, { useCallback, useContext, useState } from 'react';
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
import DynamicFlash from './DynamicFlash';
import ErrorBoundary from './ErrorBoundary';
import FoilCardImage from './FoilCardImage';

const GridLine = (type, index) => ({ type, index });

const Pack = ({ pack, packNumber, pickNumber, picking, onClickRow, onClickCol }) => {
  const [hover, setHover] = useState(null);

  const handleClick = useCallback((event) => {
    const target = event.target;
    const line = JSON.parse(target.getAttribute('data-line'));
    if (line.type === 'row') {
      onClickRow(line.index);
    } else {
      onClickColumn(line.index);
    }
  }, []);
  const handleMouseOver = useCallback((event) => {
    const target = event.target;
    const newHover = JSON.parse(target.getAttribute('data-line'));
    setHover(newHover);
  }, []);
  const handleMouseOut = useCallback(() => setHover(null), []);

  const columns = [0, 1, 2].map((n) => GridLine('column', n));
  const gridded = [
    [[0, 1, 2], pack.slice(0, 3), GridLine('row', 0)],
    [[3, 4, 5], pack.slice(3, 6), GridLine('row', 1)],
    [[6, 7, 8], pack.slice(6, 9), GridLine('row', 2)],
  ];
  return (
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
          <Col xs={2} />
          <Col xs={8}>
            <Row>
              {columns.map((line, index) =>
                <Col key={index} xs={4} className="text-center clickable" data-line={JSON.stringify(line)} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut} onClick={handleClick}>
                  <h4 className="mb-0">{index + 1}</h4>
                </Col>
              )}
            </Row>
          </Col>
        </Row>
        {gridded.map(([indices, cards, line], rowIndex) =>
          <Row key={rowIndex} noGutters className={hover && hover.type === 'row' && hover.index === rowIndex ? 'outline' : undefined}>
            <Col xs={2} className="d-flex clickable" data-line={JSON.stringify(line)} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut} onClick={handleClick}>
              <h4 className="align-self-center ml-auto mr-2">{rowIndex + 1}</h4>
            </Col>
            <Col xs={8}>
              <Row className="row-grid my-2">
                {cards.map((card, index) => (
                  <Col
                    key={index}
                    xs={4}
                    className="col-grid"
                  >
                    {!card ? false :
                      <>
                        {!picking.includes(index) ? false : <Spinner className="position-absolute" />}
                        <FoilCardImage
                          card={card}
                          className={picking.includes(index) ? 'transparent' : undefined}
                        />
                      </>
                    }
                  </Col>
                ))}
              </Row>
            </Col>
            <Col xs={2} className="clickable" data-line={JSON.stringify(line)} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut} onClick={handleClick} />
          </Row>
        )}
      </CardBody>
    </Card>
  );
}

const GridDraftPage = ({ initialDraft }) => {
  const [draft, setDraft] = useState(initialDraft);
  const pack = draft.packs[0];

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  // State for showing loading while waiting for next pick.
  // Array of indexes.
  const [picking, setPicking] = useState([]);

  const handlePick = useCallback((pickIndices) => {
    setPicking(pickIndices);

    const newDraft = { ...draft };
    const [pack, ...newPacks] = newDraft.packs;

    const pickedCards = [];
    const newPack = [...pack];
    for (const index of pickIndices) {
      pickedCards.push(newPack[index]);
      newPack[index] = null;
    }

    if (newPacks.length === 0) {
      // Done.
    } else {
    }
  });

  const handleMoveCard = useCallback((source, target) => {
    setPicks(DeckStacks.moveOrAddCard(picks, target.data, source.data));
  }, [picks]);

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
      <DynamicFlash />
      <CSRFForm className="d-none" id="submitDeckForm" method="POST" action={`/cube/submitdeck/${Draft.cube()}`}>
        <Input type="hidden" name="body" value={initialDraft.id} />
      </CSRFForm>
      <DndProvider backend={HTML5Backend}>
        <ErrorBoundary>
          <Pack
            pack={pack}
            pickNumber={0}
            packNumber={0}
            picking={[]}
          />
        </ErrorBoundary>
        <ErrorBoundary className="mt-3">
          <DeckStacks
            cards={picks}
            title="Picks"
            subtitle={subtitle}
            locationType={Location.PICKS}
            canDrop={() => true}
            onMoveCard={handleMoveCard}
            className="mt-3"
          />
        </ErrorBoundary>
      </DndProvider>
    </DisplayContextProvider>
  );
};

export default GridDraftPage;
