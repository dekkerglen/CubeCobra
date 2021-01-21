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
import UserPropType from 'proptypes/UserPropType';
import { cardType, makeSubtitle } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import { evaluateCardOrPool, getDrafterState } from 'utils/draftbots';
import Location from 'utils/DraftLocation';
import RenderToRoot from 'utils/RenderToRoot';
import { cmcColumn, fromEntries, toNullableInt } from 'utils/Util';

const canDrop = (_, target) => {
  return target.type === Location.PICKS;
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
  instructions: PropTypes.string,
  picking: PropTypes.number,
  onMoveCard: PropTypes.func.isRequired,
  onClickCard: PropTypes.func.isRequired,
};

Pack.defaultProps = {
  picking: null,
  instructions: null,
};

const getDefaultPosition = (card, picks) => {
  const row = cardType(card).toLowerCase().includes('creature') ? 0 : 1;
  const col = cmcColumn(card);
  const colIndex = picks[row][col].length;
  return [row, col, colIndex];
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
      newDraft.seats[seatIndex].drafted = DeckStacks.moveOrAddCard(newDraft.seats[seatIndex].drafted, pos, cardIndex);
    }
  },
  trashCards: ({ newDraft, cardIndices }) => {
    for (let seatIndex = 0; seatIndex < newDraft.initial_state.length; seatIndex++) {
      newDraft.seats[seatIndex].trashorder = [...newDraft.seats[seatIndex].trashorder, cardIndices[seatIndex]];
    }
  },
  moveCard: ({ newDraft, seatIndex, target, source }) => {
    newDraft.seats[seatIndex].drafted = DeckStacks.moveOrAddCard(newDraft.seats[seatIndex].drafted, target, source);
  },
});

const useDraftMutation = (mutation, setDraft, cards) =>
  useCallback(
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
    [mutation, setDraft, cards],
  );

const CubeDraftPlayerUI = ({ drafterState, drafted, takeCard, moveCard }) => {
  const {
    cards,
    cardsInPack,
    completedAmount,
    step: { action, amount: totalAmount },
    packNum,
    pickNum,
    numPacks,
  } = drafterState;
  const remainingAmount = totalAmount - completedAmount;

  const [showBotBreakdown, toggleShowBotBreakdown] = useToggle(false);
  // State for showing loading while waiting for next pick.
  const [picking, setPicking] = useState(null);
  const pack = useMemo(() => cardsInPack.map((cardIndex) => cards[cardIndex]), [cardsInPack, cards]);
  // Picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const picks = useMemo(() => drafted.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))), [
    drafted,
    cards,
  ]);
  const instructions = useMemo(() => {
    if (action === 'pick') {
      return `Pick ${remainingAmount} More Card${remainingAmount > 1 ? 's' : ''}.`;
    }
    if (action === 'trash') {
      return `Trash ${remainingAmount} More Card${remainingAmount > 1 ? 's' : ''}.`;
    }
    return null;
  }, [action, remainingAmount]);

  const handleMoveCard = useCallback(
    async (source, target) => {
      if (source.equals(target)) return;
      if (source.type === Location.PACK) {
        if (target.type === Location.PICKS) {
          setPicking(source.data);
          takeCard(cardsInPack[source.data], target.data);
          setPicking(null);
        } else {
          console.error("Can't move cards inside pack.");
        }
      } else if (source.type === Location.PICKS) {
        if (target.type === Location.PICKS) {
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
      takeCard(cardIndex);
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
              locationType={Location.PICKS}
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
const CubeDraftPage = ({ user, cube, initialDraft, seatNumber, loginCallback }) => {
  const { cards, seed } = initialDraft;
  const seatNum = toNullableInt(seatNumber) ?? 0;
  const [draft, setDraft] = useState(initialDraft);
  const submitDeckForm = useRef();
  const rng = useMemo(() => seedrandom(seed), [seed]);
  const drafterStates = useMemo(
    () => draft.seats.map((_, seatIndex) => getDrafterState({ draft, seatNumber: seatIndex })),
    [draft],
  );
  const {
    step: { action },
    numPacks,
    packNum,
  } = drafterStates[seatNum];
  const doneDrafting = packNum >= numPacks;
  const mutations = fromEntries(
    // eslint-disable-next-line
    Object.entries(MUTATIONS).map(([name, mutation]) => [name, useDraftMutation(mutation, setDraft, cards)]),
  );
  const makeBotPicks = useCallback(
    (playerChose) =>
      drafterStates.map((state, seatIndex) =>
        seatIndex === seatNum
          ? playerChose
          : state.cardsInPack
              .map((cardIndex) => evaluateCardOrPool(cardIndex, state))
              .sort(({ score: a }, { score: b }) => b - a)[0].botState.cardIndex,
      ),
    [drafterStates, seatNum],
  );
  const makeBotTrashPicks = useCallback(
    (playerChose) =>
      drafterStates.map((state, seatIndex) =>
        seatIndex === seatNum
          ? playerChose
          : state.cardsInPack
              .map((cardIndex) => [evaluateCardOrPool(cardIndex, state).score, cardIndex])
              .sort(([a], [b]) => a - b)[0][1],
      ),
    [drafterStates, seatNum],
  );

  useEffect(() => {
    (async () => {
      const submitableDraft = { ...draft, cards: draft.cards.map(({ details: _, ...card }) => ({ ...card })) };
      await csrfFetch(`/cube/api/submitdraft/${draft.cube}`, {
        method: 'POST',
        body: JSON.stringify(submitableDraft),
        headers: { 'Content-Type': 'application/json' },
      });
      if (doneDrafting) {
        // eslint-disable-next-line
        submitDeckForm.current?.submit?.();
      }
    })();
  }, [doneDrafting, draft]);
  useEffect(() => {
    if (action.match(/random/)) {
      const cardIndices = drafterStates.map((state) => state.cardsInPack[Math.floor(rng() * state.cardsInPack.length)]);
      if (action.match(/pick/)) {
        mutations.pickCards({ cardIndices });
      } else if (action.match(/trash/)) {
        mutations.trashCards({ cardIndices });
      }
    }
  }, [action, drafterStates, mutations, rng]);

  const takeCard = useCallback(
    (cardIndex, target) => {
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
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeLayout cube={cube} activeLink="playtest">
        <DisplayContextProvider>
          <CubeDraftPlayerUI
            drafterState={drafterStates[seatNum]}
            seat={draft.seats[seatNum]}
            takeCard={takeCard}
            moveCard={moveCard}
          />
          <CSRFForm
            className="d-none"
            innerRef={submitDeckForm}
            method="POST"
            action={`/cube/submitdeck/${initialDraft.cube}`}
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
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeDraftPage.defaultProps = {
  seatNumber: 0,
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeDraftPage);
