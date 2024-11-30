import React from 'react';
import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';

import Text from 'components/base/Text';
import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';
import { getDrafterState } from 'drafting/draftutil';
import useQueryParam from 'hooks/useQueryParam';
import { cardName, encodeName } from 'utils/Card';
import { getCardColorClass } from 'utils/Util';

const AutocardItem = withAutocard(ListGroupItem);

export const ACTION_LABELS = Object.freeze({
  pick: 'Picked ',
  trash: 'Trash ',
  pickrandom: 'Randomly Picked ',
  trashrandom: 'Randomly Trashed ',
});

const DecksPickBreakdown = ({ draft, seatNumber, defaultIndex }) => {
  const [pickNumber, setPickNumber] = useQueryParam('pick', defaultIndex);

  const drafterState = getDrafterState(draft, parseInt(seatNumber, 10), parseInt(pickNumber, 10));
  const { cardsInPack, pick, pack, picksList } = drafterState;

  return (
    <Row>
      <Col xs={12} sm={3}>
        <Text semibold lg>Pick Order</Text>
        {picksList.map((list, listindex) => (
          <ListGroup key={listindex} className="list-outline">
            <ListGroupItem className="list-group-heading">{`Pack ${listindex + 1}`}</ListGroupItem>
            {list.map(({ cardIndex, action, index }, pickindex) => (
              <AutocardItem
                key={`pack${listindex}pick${pickindex}`}
                card={draft.cards[cardIndex]}
                className={`card-list-item d-flex flex-row ${getCardColorClass(draft.cards[cardIndex])}`}
                data-in-modal
                onClick={() => setPickNumber(index)}
                data-pick-number={pickindex}
              >
                {drafterState.pickNumber === pickNumber ? (
                  <Text semibold>{`${ACTION_LABELS[action]}: ${cardName(draft.cards[cardIndex])}`}</Text>
                ) : (
                  <>{`${ACTION_LABELS[action]}: ${cardName(draft.cards[cardIndex])}`}</>
                )}
              </AutocardItem>
            ))}
          </ListGroup>
        ))}
      </Col>
      <Col xs={12} sm={9}>
        <Text semibold lg>{`Pack ${pack}: Pick ${pick}`}</Text>
        <Row className="g-0">
          {cardsInPack.map((cardIndex) => (
            <Col key={cardIndex} xs={4} sm={2}>
              <a href={`/tool/card/${encodeName(draft.cards[cardIndex].details.name)}`}>
                <FoilCardImage autocard data-in-modal card={draft.cards[cardIndex]} className="clickable" />
              </a>
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  );
};

DecksPickBreakdown.propTypes = {
  draft: DraftPropType.isRequired,
  seatNumber: PropTypes.number.isRequired,
  defaultIndex: PropTypes.number,
};
DecksPickBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DecksPickBreakdown;
