import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import seedrandom from 'seedrandom';
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

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckStacks from 'components/DeckStacks';
import DndProvider from 'components/DndProvider';
import { DraftbotBreakdownTable } from 'components/DraftbotBreakdown';
import DraggableCard from 'components/DraggableCard';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import useToggle from 'hooks/UseToggle';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import CubePropType from 'proptypes/CubePropType';
import { DrafterStatePropType, DraftPropType } from 'proptypes/DraftbotPropTypes';
import { makeSubtitle } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import { calculateBotPick } from 'drafting/draftbots';
import DraftLocation, { moveOrAddCard } from 'drafting/DraftLocation';
import { getDefaultPosition, getDrafterState } from 'drafting/draftutil';
import RenderToRoot from 'utils/RenderToRoot';
import { fromEntries, toNullableInt } from 'utils/Util';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canDrop = (_, target) => {
  return target.type === DraftLocation.PICKS;
};

const Pack = ({ pack, packNumber, pickNumber, instructions, picking, onMoveCard, onClickCard }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-1">
          Pack {packNumber}, Pick {pickNumber}
          {instructions ? `: ${instructions}` : ''}
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
            {picking === index && <Spinner className="position-absolute" />}
            <DraggableCard
              location={DraftLocation.pack(index)}
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
  instructions: PropTypes.string,
  picking: PropTypes.number,
  onMoveCard: PropTypes.func.isRequired,
  onClickCard: PropTypes.func.isRequired,
};

Pack.defaultProps = {
  picking: null,
  instructions: null,
};

const MUTATIONS = Object.freeze({
  pickCards: ({ newDraft, cardIndices, seatIndex: seatNum, target, cards }) => {
    for (let seatIndex = 0; seatIndex < newDraft.initial_state.length; seatIndex++) {
      const cardIndex = cardIndices[seatIndex];
      newDraft.seats[seatIndex].pickorder = [...newDraft.seats[seatIndex].pickorder, cardIndex];
      const pos =
        target && seatIndex === seatNum
          ? target
          : getDefaultPosition(cards[cardIndex], newDraft.seats[seatIndex].drafted);
      newDraft.seats[seatIndex].drafted = moveOrAddCard(newDraft.seats[seatIndex].drafted, pos, cardIndex);
    }
  },
  trashCards: ({ newDraft, cardIndices }) => {
    for (let seatIndex = 0; seatIndex < newDraft.initial_state.length; seatIndex++) {
      newDraft.seats[seatIndex].trashorder = [...newDraft.seats[seatIndex].trashorder, cardIndices[seatIndex]];
    }
  },
  moveCard: ({ newDraft, seatIndex, target, source }) => {
    newDraft.seats[seatIndex].drafted = moveOrAddCard(newDraft.seats[seatIndex].drafted, target, source);
  },
});

const useMutatableDraft = (initialDraft) => {
  const { cards } = initialDraft;
  const [draft, setDraft] = useState(initialDraft);
  const [mutations] = useState(
    fromEntries(
      Object.entries(MUTATIONS).map(([name, mutation]) => [
        name,
        ({ cardIndices, seatIndex, source, target }) =>
          setDraft((oldDraft) => {
            const newDraft = { ...oldDraft };
            if ((seatIndex || seatIndex === 0) && !cardIndices) {
              newDraft.seats = [...newDraft.seats];
              newDraft.seats[seatIndex] = { ...newDraft.seats[seatIndex] };
            } else {
              newDraft.seats = newDraft.seats.map((seat) => ({ ...seat }));
            }
            mutation({ newDraft, cardIndices, seatIndex, source, target, cards });
            return newDraft;
          }),
        // eslint-disable-next-line
      ]),
    ),
  );
  return { draft, mutations };
};

const CubeDraftPlayerUI = ({ drafterState, drafted, takeCard, moveCard }) => {
  const {
    cards,
    cardsInPack,
    step: { action, amount },
    packNum,
    pickNum,
    numPacks,
  } = drafterState;

  const [showBotBreakdown, toggleShowBotBreakdown] = useToggle(false);
  // State for showing loading while waiting for next pick.
  const [picking, setPicking] = useState(null);
  const pack = useMemo(() => cardsInPack.map((cardIndex) => cards[cardIndex]), [cardsInPack, cards]);
  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const picks = useMemo(
    () => drafted.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))),
    [drafted, cards],
  );
  const instructions = useMemo(() => {
    if (action === 'pick') {
      return `Pick ${amount + 1} More Card${amount + 1 > 1 ? 's' : ''}.`;
    }
    if (action === 'trash') {
      return `Trash ${amount + 1} More Card${amount + 1 > 1 ? 's' : ''}.`;
    }
    return null;
  }, [action, amount]);

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) return;
      if (source.type === DraftLocation.PACK) {
        if (target.type === DraftLocation.PICKS) {
          setPicking(source.data);
          await takeCard(cardsInPack[source.data], target.data);
          setPicking(null);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === DraftLocation.PICKS) {
        if (target.type === DraftLocation.PICKS) {
          moveCard({ target: target.data, source: source.data });
        } else {
          console.error("Can't move cards from picks back to pack.");
        }
      }
    },
    [setPicking, takeCard, cardsInPack, moveCard],
  );

  const handleClickCard = useCallback(
    async (event) => {
      event.preventDefault();
      /* eslint-disable-line no-undef */ autocard_hide_card();
      const cardPackIndex = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      const cardIndex = cardsInPack[cardPackIndex];
      setPicking(cardPackIndex);
      await takeCard(cardIndex);
      setPicking(null);
    },
    [cardsInPack, setPicking, takeCard],
  );
  return (
    <>
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
      <DndProvider>
        {packNum < numPacks && (
          <>
            <ErrorBoundary>
              <Pack
                pack={pack}
                packNumber={packNum + 1}
                pickNumber={pickNum + 1}
                instructions={instructions}
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
                    <DraftbotBreakdownTable drafterState={drafterState} />
                  </CardBody>
                </Card>
              </ErrorBoundary>
            )}
          </>
        )}
        <ErrorBoundary className="mt-3">
          <Card className="my-3">
            <DeckStacks
              cards={picks}
              title="Picks"
              subtitle={makeSubtitle(picks.flat(3))}
              locationType={DraftLocation.PICKS}
              canDrop={canDrop}
              onMoveCard={handleMoveCard}
            />
          </Card>
        </ErrorBoundary>
      </DndProvider>
    </>
  );
};
CubeDraftPlayerUI.propTypes = {
  drafterState: DrafterStatePropType.isRequired,
  drafted: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number.isRequired).isRequired).isRequired)
    .isRequired,
  takeCard: PropTypes.func.isRequired,
  moveCard: PropTypes.func.isRequired,
};
const CubeDraftPage = ({ cube, initialDraft, seatNumber, loginCallback }) => {
  const { seed } = initialDraft;
  const [seatNum] = useState(() => toNullableInt(seatNumber) ?? 0);
  const { draft, mutations } = useMutatableDraft(initialDraft);
  const { drafted } = draft.seats[seatNum];
  const submitDeckForm = useRef();
  const [rng] = useState(() => seedrandom(seed));
  const drafterStates = useMemo(
    () => draft.seats.map((_, seatIndex) => getDrafterState({ draft, seatNumber: seatIndex })),
    [draft],
  );
  const [action, doneDrafting] = useMemo(() => {
    const {
      step: { action: actionInner },
      numPacks,
      packNum,
    } = drafterStates[seatNum];
    return [actionInner, packNum >= numPacks];
  }, [drafterStates, seatNum]);
  const makeBotChoices = useCallback(
    (playerChose, reverse) =>
      drafterStates.map((drafterState, seatIndex) =>
        seatIndex === seatNum ? playerChose : calculateBotPick(drafterState, reverse),
      ),
    [drafterStates, seatNum],
  );
  const makeBotPicks = useCallback((playerChose) => makeBotChoices(playerChose, false), [makeBotChoices]);
  const makeBotTrashPicks = useCallback((playerChose) => makeBotChoices(playerChose, true), [makeBotChoices]);

  useEffect(() => {
    if (doneDrafting) {
      const submitableDraft = { ...draft, cards: draft.cards.map(({ details: _, ...card }) => ({ ...card })) };
      csrfFetch(`/cube/api/submitdraft/${draft.cube}`, {
        method: 'POST',
        body: JSON.stringify(submitableDraft),
        headers: { 'Content-Type': 'application/json' },
      }).then(() => {
        submitDeckForm.current?.submit?.(); // eslint-disable-line
      });
    }
  }, [doneDrafting, draft]);

  useEffect(() => {
    if (action.match(/random/) && !doneDrafting) {
      const cardIndices = drafterStates.map((state) => state.cardsInPack[Math.floor(rng() * state.cardsInPack.length)]);
      if (action.match(/pick/)) {
        mutations.pickCards({ cardIndices });
      } else if (action.match(/trash/)) {
        mutations.trashCards({ cardIndices });
      }
    }
  }, [action, drafterStates, mutations, rng, doneDrafting]);

  // This has to be async to allow the loading animation to be applied while it runs.
  const takeCard = useCallback(
    async (cardIndex, target) => {
      await sleep(0); // We have to suspend and free up the main thread at least once.
      if (action.match(/pick/)) {
        const cardIndices = makeBotPicks(cardIndex);
        mutations.pickCards({ cardIndices, seatIndex: target && seatNum, target });
      } else {
        const cardIndices = makeBotTrashPicks(cardIndex);
        mutations.trashCards({ cardIndices });
      }
    },
    [action, makeBotPicks, seatNum, makeBotTrashPicks, mutations],
  );

  const moveCard = useCallback((args) => mutations.moveCard({ ...args, seatIndex: seatNum }), [mutations, seatNum]);
  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider>
          <CubeDraftPlayerUI
            drafterState={drafterStates[seatNum]}
            drafted={drafted}
            takeCard={takeCard}
            moveCard={moveCard}
          />
          <CSRFForm
            className="d-none"
            innerRef={submitDeckForm}
            method="POST"
            action={`/cube/deck/submitdeck/${initialDraft.cube}`}
          >
            <Input type="hidden" name="body" value={initialDraft._id} />
          </CSRFForm>
        </DisplayContextProvider>
      </CubeLayout>
    </MainLayout>
  );
};

CubeDraftPage.propTypes = {
  cube: CubePropType.isRequired,
  initialDraft: DraftPropType.isRequired,
  seatNumber: PropTypes.number,
  loginCallback: PropTypes.string,
};

CubeDraftPage.defaultProps = {
  seatNumber: 0,
  loginCallback: '/',
};

export default RenderToRoot(CubeDraftPage);
