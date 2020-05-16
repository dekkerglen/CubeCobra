import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, ListGroup, ListGroupItem } from 'reactstrap';

import { getPackAsSeen } from 'components/DraftbotBreakdown';
import FoilCardImage from 'components/FoilCardImage';
import { getCardColorClass } from 'components/TagContext';
import withAutocard from 'components/WithAutocard';
import { encodeName } from 'utils/Card';
import Query from 'utils/Query';

const AutocardItem = withAutocard(ListGroupItem);

const DecksPickBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useState(defaultIndex ?? 0);
  const didMountRef1 = useRef(false);

  useEffect(() => {
    if (didMountRef1.current) {
      Query.set('pick', index);
    } else {
      const queryIndex = Query.get('pick');
      if (queryIndex || queryIndex === 0) {
        setIndex(queryIndex);
      }
      didMountRef1.current = true;
    }
    return () => Query.del('pick');
  }, [index]);

  const click = (event) => {
    if (index !== event.target.getAttribute('index')) {
      setIndex(event.target.getAttribute('index'));
    }
  };

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
      PropTypes.arrayOf(PropTypes.shape({ cards: PropTypes.array, sealed: PropTypes.bool, trash: PropTypes.number })),
    ).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        deck: PropTypes.array.isRequired,
        sideboard: PropTypes.array.isRequired,
        username: PropTypes.string.isRequired,
        userid: PropTypes.string,
        bot: PropTypes.array,
        name: PropTypes.string.isRequired,
        pickorder: PropTypes.array.isRequired,
      }),
    ).isRequired,
    cube: PropTypes.string.isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  seatIndex: PropTypes.number.isRequired,
  defaultIndex: PropTypes.number,
};

DecksPickBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DecksPickBreakdown;
