import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Col,
  Collapse,
  Input,
  Nav,
  Navbar,
  Row,
} from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';
import DraftPropType from 'proptypes/DraftPropType';

import CSRFForm from 'components/CSRFForm';
import CustomImageToggler from 'components/CustomImageToggler';
import DeckStacks from 'components/DeckStacks';
import DndProvider from 'components/DndProvider';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import FoilCardImage from 'components/FoilCardImage';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import Location, { moveOrAddCard } from 'drafting/DraftLocation';
import { getDefaultPosition } from 'drafting/draftutil';
import { calculateGridBotPick, getGridDrafterState } from 'drafting/griddraftutils';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import { makeSubtitle } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import RenderToRoot from 'utils/RenderToRoot';
import { fromEntries, toNullableInt } from 'utils/Util';

const Pack = ({ pack, packNumber, pickNumber, makePick, seatIndex, turn }) => (
  <Card className="mt-3">
    <CardHeader>
      <CardTitle className="mb-0">
        <h4>
          Pack {packNumber + 1}, Pick {pickNumber + 1}
        </h4>
        <h4 className="mb-0">
          {turn && (
            <Badge color={turn === 1 ? 'primary' : 'danger'}>{`Player ${turn === 1 ? 'one' : 'two'}'s pick`}</Badge>
          )}
        </h4>
      </CardTitle>
    </CardHeader>
    <CardBody>
      <Row className="mb-2 justify-content-center">
        <Col xs="1" />
        {[0, 1, 2].map((col) => (
          <Col key={`col-btn-${col}`} xs="3" md="2">
            <Button
              block
              outline
              color="accent"
              onClick={() => {
                makePick({
                  seatIndex,
                  cardIndices: [0, 1, 2]
                    .map((row) => [pack[3 * row + col]?.index, 3 * row + col])
                    .filter(([x]) => x || x === 0),
                });
              }}
            >
              🡇
            </Button>
          </Col>
        ))}
      </Row>
      {[0, 1, 2].map((row) => (
        <Row key={`row-${row}`} className="justify-content-center">
          <Col className="my-2" xs="1">
            <Button
              className="float-end h-100"
              outline
              color="accent"
              onClick={() => {
                makePick({
                  seatIndex,
                  cardIndices: [0, 1, 2]
                    .map((col) => [pack[3 * row + col]?.index, 3 * row + col])
                    .filter(([x]) => x || x === 0),
                });
              }}
            >
              🡆
            </Button>
          </Col>
          {[0, 1, 2].map((col) => (
            <Col key={`cell-${col}-${row}`} className="px-0" xs="3" md="2">
              {pack[row * 3 + col] ? (
                <FoilCardImage card={pack[row * 3 + col]} tags={[]} autocard />
              ) : (
                <img
                  src="/content/default_card.png"
                  alt="Empty card slot"
                  width="100%"
                  height="auto"
                  className="card-border"
                />
              )}
            </Col>
          ))}
        </Row>
      ))}
    </CardBody>
  </Card>
);

Pack.propTypes = {
  pack: PropTypes.arrayOf(CardPropType).isRequired,
  packNumber: PropTypes.number.isRequired,
  pickNumber: PropTypes.number.isRequired,
  seatIndex: PropTypes.number.isRequired,
  makePick: PropTypes.func.isRequired,
  turn: PropTypes.number,
};

Pack.defaultProps = {
  turn: null,
};

const MUTATIONS = {
  makePick: ({ newGridDraft, seatIndex, cardIndices }) => {
    console.log(cardIndices);
    newGridDraft.seats[seatIndex].pickorder.push(...cardIndices.map(([x]) => x));
    newGridDraft.seats[seatIndex].pickedIndices.push(...cardIndices.map(([, x]) => x));
    for (const [cardIndex] of cardIndices) {
      const pos = getDefaultPosition(newGridDraft.cards[cardIndex], newGridDraft.seats[seatIndex].mainboard);
      newGridDraft.seats[seatIndex].mainboard = moveOrAddCard(newGridDraft.seats[seatIndex].mainboard, pos, cardIndex);
    }
  },
};

const useMutatableGridDraft = (initialGridDraft) => {
  const { cards } = initialGridDraft;
  const [gridDraft, setGridDraft] = useState(initialGridDraft);
  const mutations = fromEntries(
    Object.entries(MUTATIONS).map(([name, mutation]) => [
      name,
      // eslint-disable-next-line
      useCallback(
        ({ seatIndex, cardIndices }) =>
          setGridDraft((oldGridDraft) => {
            const newGridDraft = { ...oldGridDraft };
            newGridDraft.seats = [...newGridDraft.seats];
            newGridDraft.seats[seatIndex] = { ...newGridDraft.seats[seatIndex] };
            mutation({ newGridDraft, seatIndex, cardIndices });
            return newGridDraft;
          }),
        // eslint-disable-next-line
        [mutation, setGridDraft, cards],
      ),
    ]),
  );
  return { gridDraft, mutations };
};

export const GridDraftPage = ({ cube, initialDraft, seatNumber, loginCallback }) => {
  const { cards } = initialDraft;
  const draftType = initialDraft.seats[1].bot ? 'bot' : '2playerlocal';
  const seatNum = toNullableInt(seatNumber) ?? 0;
  const { gridDraft, mutations } = useMutatableGridDraft(initialDraft);
  const submitDeckForm = useRef();
  const drafterStates = useMemo(() => {
    return [0, 1].map((idx) => getGridDrafterState({ gridDraft, seatNumber: idx }));
  }, [gridDraft]);
  const { turn, numPacks, packNum, pickNum } = drafterStates[seatNum];
  const { cardsInPack } = drafterStates[turn ? 0 : 1];
  const doneDrafting = packNum >= numPacks;
  const pack = useMemo(() => cardsInPack.map((cardIndex) => cards[cardIndex]), [cardsInPack, cards]);

  // picks is an array with 1st key C/NC, 2d key CMC, 3d key order
  const picked = useMemo(
    () =>
      gridDraft.seats.map(({ mainboard }) =>
        mainboard.map((row) => row.map((col) => col.map((cardIndex) => cards[cardIndex]))),
      ),
    [gridDraft, cards],
  );
  const botIndex = (seatNum + 1) % 2;
  const botDrafterState = drafterStates[botIndex];

  // The finish callback.
  useEffect(() => {
    (async () => {
      if (doneDrafting) {
        await csrfFetch(`/cube/api/submitgriddraft/${gridDraft.cube}`, {
          method: 'POST',
          body: JSON.stringify({
            seats: gridDraft.seats,
            id: gridDraft.id,
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        // eslint-disable-next-line
        submitDeckForm.current?.submit?.();
      }
    })();
  }, [doneDrafting, gridDraft]);

  useEffect(() => {
    if (botDrafterState.turn && draftType === 'bot') {
      mutations.makePick({ cardIndices: calculateGridBotPick(botDrafterState), seatIndex: botIndex });
    }
  }, [draftType, botDrafterState, mutations, botIndex]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider>
        <CubeLayout cube={cube} activeLink="playtest">
          <Navbar expand="xs" light className="usercontrols">
            <Collapse navbar>
              <Nav navbar>
                <CustomImageToggler />
              </Nav>
            </Collapse>
          </Navbar>
          <DynamicFlash />
          <CSRFForm
            className="d-none"
            innerRef={submitDeckForm}
            method="POST"
            action={`/cube/deck/submitdeck/${initialDraft.cube}`}
          >
            <Input type="hidden" name="body" value={initialDraft.id} />
          </CSRFForm>
          <DndProvider>
            <ErrorBoundary>
              <Pack
                pack={pack}
                packNumber={packNum}
                pickNumber={pickNum}
                seatIndex={turn ? 0 : 1}
                makePick={mutations.makePick}
                turn={turn ? 1 : 2}
              />
            </ErrorBoundary>
            <ErrorBoundary className="mt-3">
              <Card className="mt-3">
                <DeckStacks
                  cards={picked[0]}
                  title={draftType === 'bot' ? 'picks' : "Player One's picks"}
                  subtitle={makeSubtitle(picked[0].flat(3))}
                  locationType={Location.PICKS}
                  canDrop={() => false}
                  onMoveCard={() => {}}
                />
              </Card>
              <Card className="my-3">
                <DeckStacks
                  cards={picked[1]}
                  title={draftType === 'bot' ? 'Bot picks' : "Player Two's picks"}
                  subtitle={makeSubtitle(picked[1].flat(3))}
                  locationType={Location.PICKS}
                  canDrop={() => false}
                  onMoveCard={() => {}}
                />
              </Card>
            </ErrorBoundary>
          </DndProvider>
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

GridDraftPage.propTypes = {
  cube: CubePropType.isRequired,
  initialDraft: DraftPropType.isRequired,
  seatNumber: PropTypes.number,
  loginCallback: PropTypes.string,
};

GridDraftPage.defaultProps = {
  seatNumber: 0,
  loginCallback: '/',
};

export default RenderToRoot(GridDraftPage);
