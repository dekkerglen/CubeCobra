import React, { useEffect, useRef, useState } from 'react';

import { Row, Col, ListGroup, ListGroupItem, Table } from 'reactstrap';

import withAutocard from 'components/WithAutocard';
import Tooltip from 'components/Tooltip';
import PropTypes from 'prop-types';
import { encodeName } from 'utils/Card';
import { getCardColorClass } from 'components/TagContext';

import Query from 'utils/Query';

const AutocardItem = withAutocard(ListGroupItem);

const DraftbotBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useState(defaultIndex ?? 0);
  const didMountRef1 = useRef(false);

  const traits = [
    {
      name: 'Rating',
      description: 'The rating based on the Elo and current color commitments.',
    },
    {
      name: 'Synergy',
      description: 'A score of how well this card synergizes with the current picks.',
    },
    {
      name: 'Openness',
      description: 'A score of how open these colors appear to be.',
    },
    {
      name: 'Color',
      description: 'A score of how well these colors fit in with the current picks.',
    },
    {
      name: 'Fixing',
      description: 'The value of how well this card solves mana issues.',
    },
    {
      name: 'Format Influence',
      description: 'The influence of how well these colors fit into this format.',
    },
    {
      name: 'Total',
      description: 'The total calculated score.',
    },
  ];
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
    setIndex(event.target.getAttribute('index'));
  };
  const seat = deck.seats[seatIndex];

  if (!draft) {
    return <h4>This deck does not have a related draft log.</h4>;
  }

  const cardsInPack = [];

  let start = 0;
  let end = draft.initial_state[0][0].length;
  let picks = parseInt(index, 10);
  let pack = 0;
  let current = parseInt(seatIndex, 10);
  const picksList = [];
  let added = 0;
  let ind = 0;

  while (picks >= draft.initial_state[0][pack].length) {
    start = end;
    end += draft.initial_state[0][pack].length;
    picks -= draft.initial_state[0][pack].length;
    pack += 1;
  }

  for (let i = start + picks; i < end; i += 1) {
    cardsInPack.push(deck.seats[current].pickorder[i]);
    if (pack % 2 !== draft.initial_state[0].length % 2) {
      current += 1;
      current %= draft.initial_state.length;
    } else {
      current -= 1;
      if (current < 0) {
        current = draft.initial_state.length - 1;
      }
    }
  }

  for (const list of draft.initial_state[0]) {
    picksList.push(seat.pickorder.slice(added, added + list.length));
    added += list.length;
  }

  for (const list of picksList) {
    for (const card of list) {
      card.index = ind;
      ind += 1;
    }
  }

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
        <Table bordered className="small-table">
          <thead>
            <tr>
              <th scope="col"> </th>
              {traits.map((trait) => (
                <th key={trait.name} scope="col">
                  <Tooltip text={trait.description}>{trait.name}</Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="breakdown">
            {cardsInPack.map((card) => (
              <tr key={card.details.cardID}>
                <th scope="col">
                  <AutocardItem key={card.index} card={card} data-in-modal index={card.index}>
                    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener norefferer">
                      {card.details.name}
                    </a>
                  </AutocardItem>
                </th>
                {traits.map((trait) => (
                  <td key={trait.name}>0</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Col>
    </Row>
  );
};

DraftbotBreakdown.propTypes = {
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.array)).isRequired,
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
    comments: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  seatIndex: PropTypes.number.isRequired,
  defaultIndex: PropTypes.number,
};

DraftbotBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DraftbotBreakdown;
