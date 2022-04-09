/* eslint-disable react/no-array-index-key */
import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col, ListGroup, ListGroupItem } from 'reactstrap';

import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';
import { getCardColorClass } from 'contexts/TagContext';
import useQueryParam from 'hooks/useQueryParam';
import DraftPropType from 'proptypes/DraftPropType';
import { cardName, encodeName } from 'utils/Card';
import { getDrafterState } from 'drafting/draftutil';

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

  console.log(drafterState);

  return (
    <Row>
      <Col xs={12} sm={3}>
        <h4>Pick Order</h4>
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
                  <strong>{`${ACTION_LABELS[action]}: ${cardName(draft.cards[cardIndex])}`}</strong>
                ) : (
                  <>{`${ACTION_LABELS[action]}: ${cardName(draft.cards[cardIndex])}`}</>
                )}
              </AutocardItem>
            ))}
          </ListGroup>
        ))}
      </Col>
      <Col xs={12} sm={9}>
        <h4>{`Pack ${pack}: Pick ${pick}`}</h4>
        <Row className="g-0">
          {cardsInPack.map((cardIndex) => (
            <Col key={/* eslint-disable-line react/no-array-index-key */ cardIndex} xs={4} sm={2}>
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
