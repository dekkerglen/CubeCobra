import React, { useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { DndContext } from '@dnd-kit/core';
import { cardName, makeSubtitle } from '@utils/cardutil';
import Cube from '@utils/datatypes/Cube';
import Draft from '@utils/datatypes/Draft';
import { toNullableInt } from '@utils/Util';

import {
  applyExchange,
  calculateHousmanBotExchange,
  EXCHANGES,
  HousmanExchange,
  HousmanState,
  initHousmanState,
} from 'drafting/housmandraftutils';

import { Card, CardBody, CardHeader } from '../components/base/Card';
import Container from '../components/base/Container';
import { Flexbox } from '../components/base/Layout';
import Text from '../components/base/Text';
import CSRFForm from '../components/CSRFForm';
import DeckStacks from '../components/DeckStacks';
import HousmanCardRow from '../components/draft/HousmanCardRow';
import HousmanDraftPack from '../components/draft/HousmanDraftPack';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import RenderToRoot from '../components/RenderToRoot';
import { CSRFContext } from '../contexts/CSRFContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import { locations } from '../drafting/DraftLocation';
import CubeLayout from '../layouts/CubeLayout';
import MainLayout from '../layouts/MainLayout';
import { trackEvent } from '../utils/analytics';

interface HousmanDraftPageProps {
  cube: Cube;
  initialDraft: Draft;
  seatNumber?: number;
}

type Action = { type: 'EXCHANGE'; exchange: HousmanExchange };

const HousmanDraftPage: React.FC<HousmanDraftPageProps> = ({ cube, initialDraft, seatNumber }) => {
  const { cards } = initialDraft;
  const { csrfFetch } = useContext(CSRFContext);
  const humanSeat = toNullableInt(seatNumber?.toString() ?? '') ?? 0;

  // cards and InitialState never change after load, so closing over them in the reducer is safe.
  const initialState = useMemo(() => (initialDraft.InitialState ?? []) as unknown as number[][], [initialDraft]);

  const reducer = (state: HousmanState, action: Action): HousmanState => {
    if (action.type === 'EXCHANGE') {
      return applyExchange(state, action.exchange, cards, initialState);
    }
    return state;
  };

  const [state, dispatch] = useReducer(reducer, initialDraft, initHousmanState);
  const [selectedPoolCard, setSelectedPoolCard] = useState<number | null>(null);
  const submitDeckForm = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  const isHumanTurn = state.turn === humanSeat && !state.done;

  const onPoolClick = (cardIndex: number) => {
    if (!isHumanTurn) return;
    setSelectedPoolCard((prev) => (prev === cardIndex ? null : cardIndex));
  };

  const onHandClick = (cardIndex: number) => {
    if (!isHumanTurn || selectedPoolCard === null) return;
    dispatch({ type: 'EXCHANGE', exchange: { seat: humanSeat, handCard: cardIndex, poolCard: selectedPoolCard } });
    setSelectedPoolCard(null);
  };

  // Bots exchange automatically, one per state update, with a short delay so the human can
  // watch the shared pool change. Chains through consecutive bot turns on its own.
  useEffect(() => {
    if (state.done || state.turn === humanSeat) {
      return;
    }
    const timer = setTimeout(() => {
      const exchange = calculateHousmanBotExchange(state.hands[state.turn]!, state.pool, cards);
      if (exchange) {
        dispatch({ type: 'EXCHANGE', exchange: { ...exchange, seat: state.turn } });
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [state, humanSeat, cards]);

  // When drafting finishes, persist the final seats and hand off to the deck builder.
  useEffect(() => {
    if (!state.done || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    (async () => {
      await csrfFetch(`/cube/api/submithousmandraft/${initialDraft.cube}`, {
        method: 'POST',
        body: JSON.stringify({
          seats: state.seats,
          log: state.log,
          id: initialDraft.id,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      trackEvent('draft_complete', { type: 'housman' });
      submitDeckForm.current?.submit?.();
    })();
  }, [state.done, state.seats, state.log, csrfFetch, initialDraft.cube, initialDraft.id]);

  const humanPicks = useMemo(
    () =>
      state.seats[humanSeat]!.mainboard.map((row) =>
        row.map((col) =>
          col
            .map((cardIndex) => cards[cardIndex])
            .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined),
        ),
      ),
    [state.seats, humanSeat, cards],
  );

  // Seat.name holds a color code (e.g. "C") that's only assigned when the draft is saved, so
  // it isn't meaningful mid-draft. Derive a readable label from the seat's role instead.
  const nameForSeat = (index: number) => {
    if (index === humanSeat) return 'You';
    if (state.seats[index]?.bot) return `Bot ${index}`;
    return `Player ${index + 1}`;
  };

  const turnSeatName = nameForSeat(state.turn);

  // A card is identifiable to the viewer if it's their own or if it has ever been face-up
  // in a shared pool. Opponents' unseen cards render as card backs.
  const seenSet = useMemo(() => new Set(state.seen), [state.seen]);
  const isKnownToViewer = (cardIndex: number, seat: number) => seat === humanSeat || seenSet.has(cardIndex);

  // The most recent swap, used to highlight the latest movement: the given card now sits
  // face-up in the pool, and the taken card is now in the acting seat's hand.
  const lastEntry = state.log.length > 0 ? state.log[state.log.length - 1]! : null;
  const lastGiven = lastEntry?.given ?? null;

  // Newest-first, capped so the log stays readable during long drafts.
  const recentLog = useMemo(() => state.log.slice(-8).reverse(), [state.log]);

  const opponents = state.seats.map((seat, index) => ({ seat, index })).filter(({ index }) => index !== humanSeat);

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout cube={cube} activeLink="playtest">
          <Container xl disableCenter>
            <DynamicFlash />
            <CSRFForm
              ref={submitDeckForm}
              method="POST"
              action={`/cube/deck/submitdeck/${initialDraft.cube}`}
              formData={{ body: initialDraft.id }}
            >
              {null}
            </CSRFForm>
            <ErrorBoundary>
              <HousmanDraftPack
                cards={cards}
                pool={state.pool}
                hand={state.hands[humanSeat]!}
                selectedPoolCard={selectedPoolCard}
                highlightPoolCard={lastGiven}
                onPoolClick={onPoolClick}
                onHandClick={onHandClick}
                interactive={isHumanTurn}
                round={state.round + 1}
                numRounds={state.numRounds}
                exchangeNumber={Math.min(state.exchangesMade[state.turn]! + 1, EXCHANGES)}
                totalExchanges={EXCHANGES}
                statusText={
                  state.done ? 'Draft complete' : isHumanTurn ? 'Your turn' : `${turnSeatName} is exchanging…`
                }
                statusColor={isHumanTurn ? 'primary' : 'danger'}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <Card className="my-3">
                <CardHeader>
                  <Text semibold lg>
                    Recent Swaps
                  </Text>
                </CardHeader>
                <CardBody>
                  {recentLog.length === 0 ? (
                    <Text className="text-text-secondary">No swaps yet. Take a card from the pool to get started.</Text>
                  ) : (
                    <Flexbox direction="col" gap="1">
                      {recentLog.map((entry, i) => (
                        <Text key={`log-${state.log.length - i}`} sm>
                          <span className="font-semibold">{nameForSeat(entry.seat)}</span> took{' '}
                          <span className="font-semibold">{cardName(cards[entry.taken]!)}</span>, gave{' '}
                          {cardName(cards[entry.given]!)}
                          <span className="text-text-secondary"> · round {entry.round + 1}</span>
                        </Text>
                      ))}
                    </Flexbox>
                  )}
                </CardBody>
              </Card>
            </ErrorBoundary>
            <ErrorBoundary>
              {opponents.map(({ seat, index }) => {
                const known = (cardIndex: number) => isKnownToViewer(cardIndex, index);
                const hand = state.hands[index] ?? [];
                const kept = seat.pickorder ?? [];
                const isActive = !state.done && state.turn === index;
                return (
                  <Card key={`opponent-${index}`} className="my-3">
                    <CardHeader>
                      <Flexbox direction="row" justify="between" alignItems="center">
                        <Text semibold lg>
                          {nameForSeat(index)}
                        </Text>
                        <Text sm className="text-text-secondary">
                          {isActive
                            ? `Exchanging now (${Math.min(state.exchangesMade[index]! + 1, EXCHANGES)} of ${EXCHANGES})`
                            : `${kept.length} cards drafted`}
                        </Text>
                      </Flexbox>
                    </CardHeader>
                    <CardBody>
                      <Flexbox direction="col" gap="2">
                        <Text semibold sm>
                          Current hand
                        </Text>
                        <HousmanCardRow
                          cards={cards}
                          indices={hand}
                          isKnown={known}
                          highlight={lastEntry && lastEntry.seat === index ? lastEntry.taken : null}
                          xs={2}
                          md={2}
                          xl={1}
                        />
                        {kept.length > 0 && (
                          <>
                            <Text semibold sm>
                              Drafted pool ({kept.length}) — cards you&apos;ve seen are shown face up
                            </Text>
                            <HousmanCardRow cards={cards} indices={kept} isKnown={known} xs={2} md={1} xl={1} />
                          </>
                        )}
                      </Flexbox>
                    </CardBody>
                  </Card>
                );
              })}
            </ErrorBoundary>
            <ErrorBoundary>
              <Card className="my-3">
                <DndContext onDragEnd={() => undefined}>
                  <DeckStacks
                    cards={humanPicks}
                    title="Your picks"
                    subtitle={makeSubtitle(humanPicks.flat(3))}
                    locationType={locations.deck}
                    xs={4}
                    md={8}
                  />
                </DndContext>
              </Card>
            </ErrorBoundary>
          </Container>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(HousmanDraftPage);
