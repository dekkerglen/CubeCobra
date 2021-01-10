import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, ListGroup, ListGroupItem } from 'reactstrap';

import { getPackAsSeen } from 'components/DraftbotBreakdown';
import FoilCardImage from 'components/FoilCardImage';
import { getCardColorClass } from 'contexts/TagContext';
import withAutocard from 'components/WithAutocard';
import DeckPropType from 'proptypes/DeckPropType';
import useQueryParam from 'hooks/useQueryParam';
import { encodeName } from 'utils/Card';

const AutocardItem = withAutocard(ListGroupItem);

const DecksPickBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useQueryParam('pick', defaultIndex ?? 0);

  const click = useCallback(
    (event) => {
      if (index !== event.target.getAttribute('index')) {
        setIndex(event.target.getAttribute('index'));
      }
    },
    [index, setIndex],
  );

  if (!draft) {
    return <h4>This deck does not have a related draft log.</h4>;
  }

  const [cardsInPack, picks, pack, picksList] = getPackAsSeen(draft.initial_state, index, deck, seatIndex);

  return (
    <Row>
      <Col xs={12} sm={3}>
        <h4>Pick Order</h4>
        {picksList.map((list, listindex) => (
          <ListGroup key={/* eslint-disable-line react/no-array-index-key */ listindex} className="list-outline">
            <ListGroupItem className="list-group-heading">{`Pack ${listindex + 1}`}</ListGroupItem>
            {list.map((card) => (
              <AutocardItem
                key={card.index}
                card={card}
                className={`card-list-item d-flex flex-row ${getCardColorClass(card)}`}
                data-in-modal
                onClick={click}
                index={card.index}
              >
                {parseInt(card.index, 10) === parseInt(index, 10) ? (
                  <strong>{card.details.name}</strong>
                ) : (
                  <>{card.details.name}</>
                )}
              </AutocardItem>
            ))}
          </ListGroup>
        ))}
      </Col>
      <Col xs={12} sm={9}>
        <h4>{`Pack ${pack + 1}: Pick ${picks + 1}`}</h4>
        <Row noGutters>
          {cardsInPack.map((card, cardindex) => (
            <Col key={/* eslint-disable-line react/no-array-index-key */ cardindex} xs={4} sm={2}>
              <a href={`/tool/card/${encodeName(card.details.name)}`}>
                <FoilCardImage autocard data-in-modal card={card} className="clickable" />
              </a>
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  );
};

DecksPickBreakdown.propTypes = {
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(
      PropTypes.arrayOf(
        PropTypes.shape({
          cards: PropTypes.arrayOf(PropTypes.number).isRequired,
          pickAtTime: PropTypes.number.isRequired,
          sealed: PropTypes.bool,
          trash: PropTypes.number.isRequired,
        }),
      ),
    ).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  deck: DeckPropType.isRequired,
  seatIndex: PropTypes.number.isRequired,
  defaultIndex: PropTypes.number,
};

DecksPickBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DecksPickBreakdown;
