import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Col, Input, Row, Spinner } from 'reactstrap';

import Draft from 'utils/Draft';
import Location from 'utils/DraftLocation';
import { cmcColumn } from 'utils/Util';

import CSRFForm from 'components/CSRFForm';
import DeckStacks from 'components/DeckStacks';
import DndProvider from 'components/DndProvider';
import DraggableCard from 'components/DraggableCard';
import ErrorBoundary from 'components/ErrorBoundary';

const canDrop = (source, target) => target.type === Location.PICKS;

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

const BoosterDraftView = ({ initialDraft }) => {
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

    let newPack = Draft.pack();
    if (!Array.isArray(newPack) || newPack.length === 0) {
      // should only happen when draft is over.
      setFinished(true);
      newPack = [];
    }
    setPack([...newPack]);
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
    [pack, picks, update],
  );

  const handleClickCard = useCallback(
    async (event) => {
      event.preventDefault();
      /* eslint-disable-line no-undef */ autocard_hide_card();
      const target = event.currentTarget;
      const cardIndex = parseInt(target.getAttribute('data-index'), 10);
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
    [pack, picks, update],
  );

  const flatPicks = [].concat(...[].concat(...picks));

  return (
    <DndProvider>
      <CSRFForm
        className="d-none"
        innerRef={submitDeckForm}
        method="POST"
        action={`/cube/submitdeck/${Draft.cube()}`}
      >
        <Input type="hidden" name="body" value={Draft.id()} />
      </CSRFForm>
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
          subtitle={Draft.subtitle(flatPicks)}
          locationType={Location.PICKS}
          canDrop={canDrop}
          onMoveCard={handleMoveCard}
          className="mt-3"
        />
      </ErrorBoundary>
    </DndProvider>
  );
};

BoosterDraftView.propTypes = {
  initialDraft: PropTypes.shape({
    _id: PropTypes.string,
    bots: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
    packs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
    ratings: PropTypes.objectOf(PropTypes.number),
  }).isRequired,
};

export default BoosterDraftView;
