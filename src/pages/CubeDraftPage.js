import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Col,
  Collapse,
  Input,
  Nav,
  Navbar,
  NavLink,
  Row,
  Spinner,
} from 'reactstrap';

import Draft, { init, createSeen, addSeen, getPicked, getSeen } from 'utils/Draft';
import Location from 'utils/DraftLocation';
import { cmcColumn } from 'utils/Util';

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckStacks from 'components/DeckStacks';
import { DisplayContextProvider } from 'components/DisplayContext';
import DndProvider from 'components/DndProvider';
import DraggableCard from 'components/DraggableCard';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import CubeLayout from 'layouts/CubeLayout';
import useToggle from 'hooks/UseToggle';
import { Internal } from 'components/DraftbotBreakdown';

export const subtitle = (cards) => {
  const numCards = cards.length;
  const allTypes = cards.map((card) => (card.type_line || card.details.type).toLowerCase());
  const numLands = allTypes.filter((type) => type.includes('land')).length;
  const numNonlands = allTypes.filter(
    (type) => !type.includes('land') && !/^(plane|phenomenon|vanguard|scheme|conspiracy)$/.test(type),
  ).length;
  const numCreatures = allTypes.filter((type) => type.includes('creature')).length;
  const numNonCreatures = numNonlands - numCreatures;
  return (
    `${numCards} card${numCards === 1 ? '' : 's'}: ` +
    `${numLands} land${numLands === 1 ? '' : 's'}, ` +
    `${numNonlands} nonland: ` +
    `${numCreatures} creature${numCreatures === 1 ? '' : 's'}, ` +
    `${numNonCreatures} noncreature${numNonCreatures === 1 ? '' : 's'}`
  );
};

const canDrop = (_, target) => {
  return target.type === Location.PICKS;
};

const showPack = (draft, packNum) => {
  return packNum <= draft.initial_state[0].length;
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
            key={/* eslint-disable-line react/no-array-index-key */ `${packNumber}:${pickNumber}:${index}`}
            xs={3}
            className="col-md-1-5 col-lg-1-5 col-xl-1-5 d-flex justify-content-center align-items-center"
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

const CubeDraftPage = ({ cube, cubeID, initialDraft }) => {
  useMemo(() => init(initialDraft), [initialDraft]);

  const [pack, setPack] = useState([...Draft.pack()]);
  const [initialPackNumber, initialPickNumber] = Draft.packPickNumber();
  const [packNumber, setPackNumber] = useState(initialPackNumber);
  const [pickNumber, setPickNumber] = useState(initialPickNumber);
  const [showBotBreakdown, toggleShowBotBreakdown] = useToggle(false);

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

  const picked = createSeen();
  addSeen(picked, getPicked(0));
  const seen = getSeen(0);
  return (
    <CubeLayout cube={cube} cubeID={cubeID} activeLink="playtest">
      <DisplayContextProvider>
        <Navbar expand="xs" light className="usercontrols">
          <Collapse navbar>
            <Nav navbar>
              <CustomImageToggler />
            </Nav>
            <Nav>
              <NavLink href="#" onClick={toggleShowBotBreakdown}>
                Toggle Bot Breakdown
              </NavLink>
            </Nav>
          </Collapse>
        </Navbar>
        <DynamicFlash />
        <CSRFForm
          className="d-none"
          innerRef={submitDeckForm}
          method="POST"
          action={`/cube/submitdeck/${Draft.cube()}`}
        >
          <Input type="hidden" name="body" value={Draft.id()} />
        </CSRFForm>
        <DndProvider>
          {showPack(initialDraft, packNumber) && (
            <>
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
              {showBotBreakdown && (
                <ErrorBoundary>
                  <Card className="mt-3">
                    <CardHeader className="mb-0">
                      <h4 className="mb-0">Draftbot Breakdown</h4>
                    </CardHeader>
                    <CardBody>
                      <Internal
                        cardsInPack={pack}
                        pack={packNumber - 1}
                        picks={pickNumber - 1}
                        draft={initialDraft}
                        seen={seen}
                        picked={picked}
                      />
                    </CardBody>
                  </Card>
                </ErrorBoundary>
              )}
            </>
          )}
          <ErrorBoundary className="mt-3">
            <Card className="mt-3">
              <DeckStacks
                cards={picks}
                title="Picks"
                subtitle={subtitle(picks.flat().flat())}
                locationType={Location.PICKS}
                canDrop={canDrop}
                onMoveCard={handleMoveCard}
              />
            </Card>
          </ErrorBoundary>
        </DndProvider>
      </DisplayContextProvider>
    </CubeLayout>
  );
};

CubeDraftPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  initialDraft: PropTypes.shape({
    _id: PropTypes.string,
    bots: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
    packs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
    ratings: PropTypes.objectOf(PropTypes.number),
  }).isRequired,
};

export default CubeDraftPage;
