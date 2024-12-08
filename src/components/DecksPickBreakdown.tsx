import React from 'react';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';

import Deck from 'datatypes/Draft';

import { getDrafterState } from 'drafting/draftutil';
import useQueryParam from 'hooks/useQueryParam';
import CardListGroup from './card/CardListGroup';
import CardGrid from './card/CardGrid';

export const ACTION_LABELS = Object.freeze({
  pick: 'Picked ',
  trash: 'Trash ',
  pickrandom: 'Randomly Picked ',
  trashrandom: 'Randomly Trashed ',
});

interface DecksPickBreakdownProps {
  draft: Deck;
  seatNumber: number;
  defaultIndex?: string;
}

const DecksPickBreakdown: React.FC<DecksPickBreakdownProps> = ({ draft, seatNumber, defaultIndex = '0' }) => {
  const [pickNumber, setPickNumber] = useQueryParam('pick', defaultIndex);

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
                    picks += draft.InitialState[0][i].cards.length;
                  }
                  setPickNumber((picks + index).toString());
                }}
              />
            ))}
        </Flexbox>
      </Col>
      <Col xs={6} sm={8} lg={9} xl={10}>
        <Text semibold lg>{`Pack ${(pack || 0) + 1}: Pick ${pick}`}</Text>
        <CardGrid xs={2} sm={3} lg={4} xl={5} cards={cardsInPack.map((cardIndex) => draft.cards[cardIndex])} />
      </Col>
    </Row>
  );
};

export default DecksPickBreakdown;
