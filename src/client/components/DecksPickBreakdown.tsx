import React, { useMemo } from 'react';

import Deck from '../../datatypes/Draft';
import { getDrafterState } from '../../util/draftutil';
import useQueryParam from '../hooks/useQueryParam';
import { Col, Flexbox, Row } from './base/Layout';
import Text from './base/Text';
import CardGrid from './card/CardGrid';
import CardListGroup from './card/CardListGroup';

export const ACTION_LABELS = Object.freeze({
  pick: 'Picked ',
  trash: 'Trash ',
  pickrandom: 'Randomly Picked ',
  trashrandom: 'Randomly Trashed ',
});

interface BreakdownProps {
  draft: Deck;
  seatNumber: number;
  pickNumber: string;
  setPickNumber: (pickNumber: string) => void;
}

const CubeCobraBreakdown: React.FC<BreakdownProps> = ({ draft, seatNumber, pickNumber, setPickNumber }) => {
  const drafterState = getDrafterState(draft, seatNumber, parseInt(pickNumber));
  const { cardsInPack, pick, pack, picksList } = drafterState;

  return (
    <Row>
      <Col xs={6} sm={4} lg={3} xl={2}>
        <Text semibold lg>
          Pick Order
        </Text>
        <Flexbox direction="col" gap="2">
          {picksList
            .filter((list) => list.length > 0)
            .map((list, listindex) => (
              <CardListGroup
                cards={list.map(({ cardIndex }) => draft.cards[cardIndex])}
                heading={`Pack ${listindex + 1}`}
                key={listindex}
                onClick={(index) => {
                  let picks = 0;
                  for (let i = 0; i < listindex; i++) {
                    if (draft.InitialState !== undefined) {
                      picks += draft.InitialState[0][i].cards.length;
                    }
                  }
                  setPickNumber((picks + index).toString());
                }}
              />
            ))}
        </Flexbox>
      </Col>
      <Col xs={6} sm={8} lg={9} xl={10}>
        <Text semibold lg>{`Pack ${(pack || 0) + 1}: Pick ${pick}`}</Text>
        <CardGrid
          xs={2}
          sm={3}
          md={4}
          lg={5}
          xl={6}
          cards={cardsInPack.map((cardIndex) => draft.cards[cardIndex])}
          hrefFn={(card) => `/tool/card/${card?.details?.scryfall_id}`}
        />
      </Col>
    </Row>
  );
};

const DraftmancerBreakdown: React.FC<BreakdownProps> = ({ draft, seatNumber, pickNumber, setPickNumber }) => {
  const { cardsInPack, pick, pack, picksList } = useMemo(() => {
    const log = draft.DraftmancerLog?.players[seatNumber];

    if (!log) {
      return {
        cardsInPack: [],
        pick: 0,
        pack: 0,
        picksList: [],
      };
    }

    const picksList = [];
    let subList = [];
    let cardsInPack: number[] = [];
    //The pick number within the pack, for the overall pick matching pickNumber
    let pick: number = 1;
    //Track the pick number within the pack as we traverse the overall picks, since Draftmancer doesn't segment into packs unlike CubeCobra
    let currentPackPick: number = 0;
    //The pack currently within
    let pack = 1;

    for (let i = 0; i < log.length; i++) {
      currentPackPick += 1;
      subList.push(log[i].pick);
      // if this is the last pack, or the next item is a new pack
      if (i === log.length - 1 || log[i].booster.length < log[i + 1].booster.length) {
        picksList.push(subList);
        subList = [];

        if (i < parseInt(pickNumber)) {
          pack += 1;
          currentPackPick = 0;
        }
      }

      if (i === parseInt(pickNumber)) {
        cardsInPack = log[i].booster;
        pick = currentPackPick;
      }
    }

    return {
      picksList,
      cardsInPack,
      pick,
      pack,
    };
  }, [draft.DraftmancerLog?.players, pickNumber, seatNumber]);

  return (
    <Row>
      <Col xs={6} sm={4} lg={3} xl={2}>
        <Text semibold lg>
          Pick Order
        </Text>
        <Flexbox direction="col" gap="2">
          {picksList
            .filter((list) => list.length > 0)
            .map((list, listindex) => (
              <CardListGroup
                cards={list.map((cardIndex) => draft.cards[cardIndex])}
                heading={`Pack ${listindex + 1}`}
                key={listindex}
                onClick={(index) => {
                  let picks = 0;
                  for (let i = 0; i < listindex; i++) {
                    picks += picksList[i].length;
                  }
                  setPickNumber((picks + index).toString());
                }}
              />
            ))}
        </Flexbox>
      </Col>
      <Col xs={6} sm={8} lg={9} xl={10}>
        <Text semibold lg>{`Pack ${pack || 0}: Pick ${pick}`}</Text>
        <CardGrid
          xs={2}
          sm={3}
          md={4}
          lg={5}
          xl={6}
          cards={cardsInPack.map((cardIndex) => draft.cards[cardIndex])}
          hrefFn={(card) => `/tool/card/${card?.details?.scryfall_id}`}
        />
      </Col>
    </Row>
  );
};

interface DecksPickBreakdownProps {
  draft: Deck;
  seatNumber: number;
  defaultIndex?: string;
}

const DecksPickBreakdown: React.FC<DecksPickBreakdownProps> = ({ draft, seatNumber, defaultIndex = '0' }) => {
  const [pickNumber, setPickNumber] = useQueryParam('pick', defaultIndex);

  if (draft.InitialState !== undefined) {
    return (
      <CubeCobraBreakdown pickNumber={pickNumber} seatNumber={seatNumber} draft={draft} setPickNumber={setPickNumber} />
    );
  }

  // This might be a draftmancer log

  if (draft.DraftmancerLog) {
    return (
      <DraftmancerBreakdown
        pickNumber={pickNumber}
        seatNumber={seatNumber}
        draft={draft}
        setPickNumber={setPickNumber}
      />
    );
  }

  // This is something else

  return <Text>Sorry, we cannot display the pick breakdown for this draft.</Text>;
};

export default DecksPickBreakdown;
