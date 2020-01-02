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

const Pack = ({ pack, packNumber, pickNumber, picking, onClickRow, onClickCol }) =>
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">
          Pack {packNumber}, Pick {pickNumber}
        </h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      <Row className="row-low-padding">
        {pack.map((card, index) => (
          <Col
            key={index}
            xs={4}
            className="col-low-padding mt-1"
          >
            {picking !== index ? false : <Spinner className="position-absolute" />}
            <FoilCardImage
              card={card}
              className={picking.includes(index) ? 'transparent' : undefined}
            />
          </Col>
        ))}
      </Row>
    </CardBody>
  </Card>;

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
