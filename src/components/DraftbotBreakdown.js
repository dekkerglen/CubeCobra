import React, { useEffect, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';
import DraftPropType from 'proptypes/DraftPropType';
import { Row, Col, ListGroup, ListGroupItem } from 'reactstrap';

import withAutocard from 'components/WithAutocard';
import { getCardColorClass } from 'contexts/TagContext';
import { init } from 'utils/Draft';
import { getPickState } from 'utils/draftbots';
import Query from 'utils/Query';

const AutocardItem = withAutocard(ListGroupItem);

const DraftbotBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useState(seatIndex ?? defaultIndex);
  const didMountRef1 = useRef(false);

  // Have to do useMemo so it happens immediately
  useMemo(() => init(draft), [draft]);

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

  // find the information for the selected pack
  const pickState = getPickState(draft, index, draft.seats[index].pickOrder.length);

  console.log(pickState);

  return (
    <>
      <h4>Pick Order</h4>
      <Row>
        {picksList.map((list, listindex) => (
          <Col xs={6} sm={3} key={/* eslint-disable-line react/no-array-index-key */ listindex}>
            <ListGroup className="list-outline">
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
          </Col>
        ))}
      </Row>
      <h4>{`Pack ${pack + 1}: Pick ${picks + 1} Cards`}</h4>
    </>
  );
};

DraftbotBreakdown.propTypes = {
  draft: DraftPropType.isRequired,
  deck: DeckPropType.isRequired,
  seatIndex: PropTypes.string.isRequired,
  defaultIndex: PropTypes.number,
};

DraftbotBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DraftbotBreakdown;
