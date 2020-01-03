import React, { useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Collapse, Input, Nav, Navbar, Row, Spinner } from 'reactstrap';

import { botRating } from '../util/Draft';
import Location from '../util/DraftLocation';
import { classes, cmcColumn } from '../util/Util';

import CSRFForm from './CSRFForm';
import CustomImageToggler from './CustomImageToggler';
import DeckStacks from './DeckStacks';
import { DisplayContextProvider } from './DisplayContext';
import DynamicFlash from './DynamicFlash';
import ErrorBoundary from './ErrorBoundary';
import FoilCardImage from './FoilCardImage';

class GridLine {
  constructor(type, index) {
    this.type = type;
    this.index = index;
  }

  static fromString(str) {
    const obj = JSON.parse(str);
    return new GridLine(obj.type, obj.index);
  }

  toString() {
    return JSON.stringify({ type: this.type, index: this.index });
  }

  is(type, index) {
    return this.equals(new GridLine(type, index));
  }

  equals(other) {
    return this.type === other.type && this.index === other.index;
  }

  indices() {
    if (this.type === 'row') {
      return [0, 1, 2].map((n) => 3 * this.index + n);
    } else {
      return [0, 1, 2].map((n) => 3 * n + this.index);
    }
  }
}

const Pack = ({ pack, packNumber, pickNumber, picking, onClick }) => {
  const [hover, setHover] = useState(null);

  const handleClick = useCallback((event) => {
    const target = event.currentTarget;
    const line = GridLine.fromString(target.getAttribute('data-line'));
    onClick(line);
  }, [onClick]);
  const handleMouseOver = useCallback((event) => {
    const target = event.currentTarget;
    const newHover = GridLine.fromString(target.getAttribute('data-line'));
    setHover(newHover);
  }, []);
  const handleMouseOut = useCallback(() => setHover(null), []);
  const interactProps = picking.length > 0 ? {} : {
    onClick: handleClick,
    onMouseOver: handleMouseOver,
    onMouseOut: handleMouseOut,
  };

  const columns = [0, 1, 2].map((n) => new GridLine('column', n));
  const gridded = [
    [[0, 1, 2], pack.slice(0, 3), new GridLine('row', 0)],
    [[3, 4, 5], pack.slice(3, 6), new GridLine('row', 1)],
    [[6, 7, 8], pack.slice(6, 9), new GridLine('row', 2)],
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
      <CardBody className="position-relative">
        <Row noGutters>
          <Col xs={2} />
          <Col xs={8} className="position-static">
            <Row className="row-grid">
              {columns.map((line, index) =>
                <Col
                  key={index}
                  xs={4}
                  className="text-center clickable col-grid position-static"
                  data-line={JSON.stringify(line)}
                  {...interactProps}
                >
                  <h4 className="mb-0">{index + 1}</h4>
                  {picking.length === 0 && hover && hover.is('column', index) && (
                    <div className="grid-hover column-hover" />
                  )}
                </Col>
              )}
            </Row>
          </Col>
        </Row>
        {gridded.map(([indices, cards, line], rowIndex) =>
          <Row key={rowIndex} noGutters className={picking.length === 0 && hover && hover.is('row', rowIndex) ? 'grid-hover' : undefined}>
            <Col xs={2} className={classes('d-flex py-2', picking.length === 0 && 'clickable')}  data-line={JSON.stringify(line)} {...interactProps}>
              <h4 className="align-self-center ml-auto mr-2">{rowIndex + 1}</h4>
            </Col>
            <Col xs={8}>
              <Row className="row-grid">
                {cards.map((card, index) => {
                  const isPicking = card && picking.includes(rowIndex * 3 + index);
                  return (
                    <Col
                      key={index}
                      xs={4}
                      className="col-grid d-flex justify-content-center align-items-center"
                    >
                      {!isPicking ? false : <Spinner className="position-absolute" />}
                      <FoilCardImage
                        card={card}
                        className={classes('my-2', isPicking && 'transparent')}
                      />
                    </Col>
                  );
                })}
              </Row>
            </Col>
            <Col xs={2} className={classes(picking.length === 0 && 'clickable')} data-line={JSON.stringify(line)} {...interactProps} />
          </Row>
        )}
      </CardBody>
    </Card>
  );
};

// Returns updated draft.
const options = [
  ...[0, 1, 2].map((n) => new GridLine('column', n)),
  ...[0, 1, 2].map((n) => new GridLine('row', n)),
];
const makeBotPicks = (draft) => {
  const newDraft = { ...draft };
  const pack = draft.packs[0];
  const botColors = draft.bots[0];
  let maxScore = 0;
  let maxOption = options[0];
  for (const option of options) {
    const optionCards = option.indices().map((i) => pack[i]);
    const optionScores = optionCards.map((card) => card ? (1 - botRating(draft, botColors, card)) : 0);
    const score = optionScores.reduce((a, b) => a + b);
    if (score >= maxScore) {
      maxScore = score;
      maxOption = option;
    }
  }

  const newPack = [...pack];
  const newBotPicks = [...draft.picks[1]];
  for (const index of maxOption.indices()) {
    newBotPicks.push(pack[index]);
    newPack[index] = null;
  }
  newDraft.packs = [newPack, ...newDraft.packs.slice(1)];
  newDraft.picks = [newDraft.picks[0], newBotPicks];
  return newDraft;
};

const GridDraftPage = ({ initialDraft }) => {
  const [draft, setDraft] = useState(initialDraft);
  const pack = draft.packs[0];

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  // State for showing loading while waiting for next pick.
  // Array of indexes.
  const [picking, setPicking] = useState([]);

  const pickCards = useCallback(async (pickIndices) => {
    setPicking(pickIndices);

    let newDraft = { ...draft };
    const second = pack.some(card => card === null);

    const pickedCards = [];
    const newPack = [...pack];
    for (const index of pickIndices) {
      pickedCards.push(newPack[index]);
      newPack[index] = null;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (second) {
      // This is the second pick from the pack, so pass and then you pick again.
      newDraft.packs = newDraft.packs.slice(1);
    } else {
      // This is the first pick from the pack, so bots pick, pass, and bots pick again.
      newDraft.packs = [newPack, ...newDraft.packs.slice(1)];
      newDraft = makeBotPicks(newDraft);
      newDraft.packs = newDraft.packs.slice(1);
      newDraft = makeBotPicks(newDraft);
    }
    setPicking([]);
    setDraft(newDraft);
  }, [draft, pack]);

  const handleClick = useCallback(({ type, index }) => {
    if (type === 'row') {
      pickCards([index * 3, index * 3 + 1, index * 3 + 2]);
    } else {
      pickCards([index, index + 3, index + 6]);
    }
  }, [pickCards]);

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
      <CSRFForm className="d-none" id="submitDeckForm" method="POST" action={`/cube/submitdeck/${initialDraft.cubeID}`}>
        <Input type="hidden" name="body" value={initialDraft.id} />
      </CSRFForm>
      <DndProvider backend={HTML5Backend}>
        <ErrorBoundary>
          <Pack
            pack={pack}
            pickNumber={draft.pickNumber}
            packNumber={draft.packNumber}
            picking={picking}
            onClick={handleClick}
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
