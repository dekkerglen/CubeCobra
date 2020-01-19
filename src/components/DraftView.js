import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Col, Collapse, Input, Nav, Navbar, Row, Spinner } from 'reactstrap';

import Draft from '../util/Draft';
import Location from '../util/DraftLocation';
import { cmcColumn } from '../util/Util';

import CSRFForm from './CSRFForm';
import CustomImageToggler from './CustomImageToggler';
import DeckStacks from './DeckStacks';
import { DisplayContextProvider } from './DisplayContext';
import DndProvider from './DndProvider';
import DraggableCard from './DraggableCard';
import DynamicFlash from './DynamicFlash';
import ErrorBoundary from './ErrorBoundary';

export const subtitle = (cards) => {
  const numCards = cards.length;
  const allTypes = cards.map((card) => (card.type_line || card.details.type).toLowerCase());
  const numLands = allTypes.filter((type) => type.includes('land')).length;
  const numNonlands = allTypes.filter(
    (type) => !type.includes('land') && !/^(plane|phenomenon|vanguard|scheme|conspiracy)$/.test(type),
  ).length;
  const numCreatures = allTypes.filter((type) => type.includes('creature')).length;
  return (
    `${numCards} card${numCards === 1 ? '' : 's'}: ` +
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numNonlands} nonland: ` +
    `${numCreatures} creatures, ` +
    `${numNonlands - numCreatures} noncreatures`
  );
};

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
            key={`${packNumber}:${pickNumber}:${index}`}
            xs={3}
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

const DraftView = ({ initialDraft }) => {
  useMemo(() => Draft.init(initialDraft), [initialDraft]);

  const [pack, setPack] = useState([...Draft.pack()]);
  const [initialPackNumber, initialPickNumber] = Draft.packPickNumber();
  const [packNumber, setPackNumber] = useState(initialPackNumber);
  const [pickNumber, setPickNumber] = useState(initialPickNumber);

  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const [picks, setPicks] = useState([new Array(8).fill([]), new Array(8).fill([])]);

  // State for showing loading while waiting for next pick.
  const [picking, setPicking] = useState(null);

  const [finished, setFinished] = useState(false);

  const submitDeckForm = useRef();

  const update = useCallback(async (newPicks) => {
    // This is very bad architecture. The React component should manage the state.
    // TODO: Move state inside React.
    const [currentPackNumber, currentPickNumber] = Draft.packPickNumber();
    setPackNumber(currentPackNumber);
    setPickNumber(currentPickNumber);
    setPicks(newPicks);
    Draft.arrangePicks([].concat(newPicks[0], newPicks[1]));

    let pack = Draft.pack();
    if (!Array.isArray(pack) || pack.length === 0) {
      // should only happen when draft is over.
      setFinished(true);
      pack = [];
    }
    setPack([...pack]);
  }, []);

  useEffect(() => {
    (async () => {
      if (finished) {
        await Draft.finish();
        if (submitDeckForm.current) {
          submitDeckForm.current.submit();
        }
      }
    })();
  }, [finished]);

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) {
        return;
      }
      if (source.type === Location.PACK) {
        if (target.type === Location.PICKS) {
          await Draft.pick(source.data);
          const newPicks = DeckStacks.moveOrAddCard(picks, target.data, pack[source.data]);
          update(newPicks);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === Location.PICKS) {
        if (target.type === Location.PICKS) {
          const newPicks = DeckStacks.moveOrAddCard(picks, target.data, source.data);
          update(newPicks);
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
      const newPicks = DeckStacks.moveOrAddCard(picks, [row, col, colIndex], card);
      update(newPicks);
    },
    [pack, picks],
  );

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
      <CSRFForm className="d-none" innerRef={submitDeckForm} method="POST" action={`/cube/submitdeck/${Draft.cube()}`}>
        <Input type="hidden" name="body" value={Draft.id()} />
      </CSRFForm>
      <DndProvider>
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
        <ErrorBoundary className="mt-3">
          <DeckStacks
            cards={picks}
            title="Picks"
            subtitle={subtitle(picks.flat().flat())}
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
