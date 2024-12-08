import React from 'react';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';

import Deck from 'datatypes/Draft';

import FoilCardImage from 'components/FoilCardImage';
import { getDrafterState } from 'drafting/draftutil';
import useQueryParam from 'hooks/useQueryParam';
import { encodeName } from 'utils/Card';
import CardListGroup from './card/CardListGroup';

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
      <Col xs={12} sm={3}>
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
                onClick={(index) => setPickNumber(`${index}`)}
              />
            ))}
        </Flexbox>
      </Col>
      <Col xs={12} sm={9}>
        <Text semibold lg>{`Pack ${(pack || 0) + 1}: Pick ${pick}`}</Text>
        <Row className="g-0">
          {cardsInPack.map((cardIndex) => (
            <Col key={cardIndex} xs={4} sm={2}>
              <a href={`/tool/card/${encodeName(draft.cards[cardIndex]?.details?.name ?? '')}`}>
                <FoilCardImage autocard data-in-modal card={draft.cards[cardIndex]} className="clickable" />
              </a>
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  );
};

export default DecksPickBreakdown;
