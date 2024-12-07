import React from 'react';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';

import Draft from 'datatypes/Draft';

import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';
import { getDrafterState } from 'drafting/draftutil';
import useQueryParam from 'hooks/useQueryParam';
import { cardName, encodeName } from 'utils/Card';
import { getCardColorClass } from 'utils/Util';

const AutocardItem = withAutocard('div');

export const ACTION_LABELS = Object.freeze({
  pick: 'Picked ',
  trash: 'Trash ',
  pickrandom: 'Randomly Picked ',
  trashrandom: 'Randomly Trashed ',
});

interface DecksPickBreakdownProps {
  draft: Draft;
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
        {picksList.map((list, listindex) => (
          <div key={listindex} className="list-outline">
            <div className="list-group-heading">{`Pack ${listindex + 1}`}</div>
            {list.map(({ cardIndex, action, index }, pickindex) => {
              const actionKey = action as keyof typeof ACTION_LABELS;
              return (
                <AutocardItem
                  key={`pack${listindex}pick${pickindex}`}
                  card={draft.cards[cardIndex]}
                  className={`card-list-item d-flex flex-row ${getCardColorClass(draft.cards[cardIndex])}`}
                  data-in-modal
                  onClick={() => setPickNumber(`${index}`)}
                  data-pick-number={pickindex}
                >
                  {drafterState.pick === parseInt(pickNumber) ? (
                    <Text semibold>{`${ACTION_LABELS[actionKey]}: ${cardName(draft.cards[cardIndex])}`}</Text>
                  ) : (
                    <>{`${ACTION_LABELS[actionKey]}: ${cardName(draft.cards[cardIndex])}`}</>
                  )}
                </AutocardItem>
              );
            })}
          </div>
        ))}
      </Col>
      <Col xs={12} sm={9}>
        <Text semibold lg>{`Pack ${pack}: Pick ${pick}`}</Text>
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
