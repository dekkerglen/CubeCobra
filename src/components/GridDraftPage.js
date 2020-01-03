import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

import { Card, CardBody, CardHeader, CardTitle, Col, Collapse, Input, Nav, Navbar, Row, Spinner } from 'reactstrap';

import { botRating, saveDraft } from '../util/Draft';
import Location from '../util/DraftLocation';
import { classes, cmcColumn } from '../util/Util';

import CSRFForm from './CSRFForm';
import CustomImageToggler from './CustomImageToggler';
import DeckStacks from './DeckStacks';
import DeckStacksStatic from './DeckStacksStatic';
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

  repr() {
    return `GridLine('${this.type}', ${this.index})`;
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

  cards(pack) {
    return this.indices().map((i) => pack[i]);
  }
}

const Pack = ({ pack, packNumber, pickNumber, picking, onClick }) => {
  const [hover, setHover] = useState(null);

  const handleClick = useCallback((event) => {
    const target = event.currentTarget;
    const line = GridLine.fromString(target.getAttribute('data-line'));
    if (line && line.cards(pack).some(card => card !== null)) {
      onClick(line);
      setHover(null);
    }
  }, [onClick]);
  const handleMouseOver = useCallback((event) => {
    const target = event.currentTarget;
    const newHover = GridLine.fromString(target.getAttribute('data-line'));
    if (newHover && newHover.cards(pack).some(card => card !== null)) {
      setHover(newHover);
    }
  }, [pack]);
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

Pack.propTypes = {
  pack: PropTypes.arrayOf(PropTypes.object).isRequired,
  packNumber: PropTypes.number.isRequired,
  pickNumber: PropTypes.number.isRequired,
  picking: PropTypes.arrayOf(PropTypes.number),
  onClick: PropTypes.func.isRequired,
};

// Returns [updated draft, selected cards].
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
  const pickedCards = [];
  for (const index of maxOption.indices()) {
    pickedCards.push(pack[index]);
    newPack[index] = null;
  }
  newDraft.packs = [newPack, ...newDraft.packs.slice(1)];
  newDraft.picks = [newDraft.picks[0], [...newDraft.picks[1], ...pickedCards]];
  return newDraft;
};

const GridDraftPage = ({ initialDraft }) => {
  const [draft, setDraft] = useState(initialDraft);
  const pack = draft.packs[0];

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);
  const [botPicks, setBotPicks] = useState([new Array(8).fill([])]);

  // State for showing loading while waiting for next pick.
  // Array of indexes.
  const [picking, setPicking] = useState([]);

  const submitForm = useRef();

  const finishDraft = useCallback(async (newDraft) => {
    newDraft.pickOrder = newDraft.picks[0].map(card => card.cardID);
    // Arrange picks as user has them.
    newDraft.picks[0] = [...picks[0], ...picks[1]];
    await saveDraft(newDraft);
    if (submitForm.current) {
      submitForm.current.submit();
    }
  }, [submitForm, picks]);

  const pickCards = useCallback(async (pickIndices) => {
    setPicking(pickIndices);

    let newDraft = { ...draft };
    const second = pack.some(card => card === null);

    const pickedCardNames = [];
    const newPack = [...pack];
    newDraft.picks = [...newDraft.picks];
    newDraft.picks[0] = [...newDraft.picks[0]];
    for (const index of pickIndices) {
      const card = newPack[index];
      if (!card) continue;
      const typeLine = (card.type_line || card.details.type).toLowerCase();
      const row = typeLine.includes('creature') ? 0 : 1;
      const col = cmcColumn(card);
      const colIndex = picks[row][col].length;
      newDraft.picks[0].push(card);
      pickedCardNames.push(card.details.name);

      setPicks(DeckStacks.moveOrAddCard(picks, [row, col, colIndex], card));
      newPack[index] = null;
    }

    await csrfFetch('/cube/api/draftpickcard/' + draft.cube, {
      method: 'POST',
      body: JSON.stringify({
        draft_id: draft._id,
        picks: pickedCardNames,
        pack: pack.filter((c) => c !== null).map((c) => c.details.name),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (second) {
      // This is the second pick from the pack, so pass and then you pick again.
      newDraft.packs = newDraft.packs.slice(1);
      newDraft.pickNumber = 1;
      newDraft.packNumber += 1;
      if (newDraft.packs.length === 0) {
        return await finishDraft(newDraft);
      }
    } else {
      // This is the first pick from the pack, so bots pick, pass, and bots pick again.
      let numBotPicks = newDraft.picks[1].length;
      newDraft.packs = [newPack, ...newDraft.packs.slice(1)];
      newDraft = makeBotPicks(newDraft);

      let picked = newDraft.picks[1].slice(numBotPicks);
      let newBotPicks = botPicks;
      for (const card of picked) {
        newBotPicks = DeckStacks.moveOrAddCard(newBotPicks, [0, (newDraft.packNumber - 1) % 8, -1], card);
      }
      numBotPicks += picked.length;

      // pass
      newDraft.packs = newDraft.packs.slice(1);
      newDraft.packNumber += 1;
      if (newDraft.packs.length === 0) {
        setBotPicks(newBotPicks);
        return await finishDraft(newDraft);
      }

      // bot pick again.
      newDraft = makeBotPicks(newDraft);
      picked = newDraft.picks[1].slice(numBotPicks);
      for (const card of picked) {
        newBotPicks = DeckStacks.moveOrAddCard(newBotPicks, [0, (newDraft.packNumber - 1) % 8, -1], card);
      }
      newDraft.pickNumber = 2;
      setBotPicks(newBotPicks);
    }
    setPicking([]);
    setDraft(newDraft);
  }, [draft, pack, picks, botPicks, finishDraft]);

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
      <CSRFForm className="d-none" innerRef={submitForm} method="POST" action={`/cube/submitdeck/${initialDraft.cube}`}>
        <Input type="hidden" name="body" value={initialDraft._id} />
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
          <DeckStacksStatic
            title="Bot Picks"
            className="mt-3"
            cards={botPicks}
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
