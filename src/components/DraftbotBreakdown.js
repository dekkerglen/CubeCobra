import React, { useEffect, useRef, useState, useMemo } from 'react';

import { Row, Col, ListGroup, ListGroupItem, Table } from 'reactstrap';

import withAutocard from 'components/WithAutocard';
import Tooltip from 'components/Tooltip';
import PropTypes from 'prop-types';
import { encodeName, COLOR_COMBINATIONS } from 'utils/Card';
import { addSeen } from 'utils/Draft';
import { fromEntries } from 'utils/Util';
import { getCardColorClass } from 'components/TagContext';
import useSortableData from 'hooks/UseSortableData';
import HeaderCell from 'components/HeaderCell';

import Query from 'utils/Query';
import {
  getRating,
  getColor,
  getSynergy,
  getOpenness,
  getFixing,
  getRatingWeight,
  getSynergyWeight,
  getOpennessWeight,
  getColorWeight,
  getFixingWeight,
  botRatingAndCombination,
} from 'utils/draftbots';

const AutocardItem = withAutocard(ListGroupItem);

const getPackAsSeen = (initialState, seat, index, deck, seatIndex) => {
  const cardsInPack = [];

  let start = 0;
  let end = initialState[0][0].length;
  let pack = 0;
  let current = parseInt(seatIndex, 10);
  let picks = parseInt(index, 10);

  while (picks >= initialState[0][pack].length) {
    start = end;
    end += initialState[0][pack].length;
    picks -= initialState[0][pack].length;
    pack += 1;
  }

  for (let i = start + picks; i < end; i += 1) {
    cardsInPack.push(deck.seats[current].pickorder[i]);
    if (pack % 2 !== initialState[0].length % 2) {
      current += 1;
      current %= initialState.length;
    } else {
      current -= 1;
      if (current < 0) {
        current = initialState.length - 1;
      }
    }
  }

  return [cardsInPack, picks, pack];
};

const DraftbotBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useState(defaultIndex ?? 0);
  const didMountRef1 = useRef(false);

  const traits = [
    {
      name: 'Rating',
      description: 'The rating based on the Elo and current color commitments.',
      weight: getRatingWeight,
      function: (combination, card) => getRating(combination, card).toFixed(2),
    },
    {
      name: 'Synergy',
      description: 'A score of how well this card synergizes with the current picks.',
      weight: getSynergyWeight,
      function: (combination, card, picked, synergies) => getSynergy(combination, card, picked, synergies).toFixed(2),
    },
    {
      name: 'Openness',
      description: 'A score of how open these colors appear to be.',
      weight: getOpennessWeight,
      function: (combination, card, picked, synergies, overallPool, seen) =>
        getOpenness(combination, seen, overallPool, card, picked, synergies).toFixed(2),
    },
    {
      name: 'Color',
      description: 'A score of how well these colors fit in with the current picks.',
      weight: getColorWeight,
      function: (combination, card, picked) => getColor(combination, picked, card).toFixed(2),
    },
    {
      name: 'Fixing',
      description: 'The value of how well this card solves mana issues.',
      weight: getFixingWeight,
      function: (combination, card, picked) => getFixing(combination, picked, card).toFixed(2),
    },
    {
      name: 'Combination',
      description: 'This is the color combination the bot is assuming that will maximize the total score.',
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
    if (index !== event.target.getAttribute('index')) {
      setIndex(event.target.getAttribute('index'));
    }
  };

  const seat = deck.seats[seatIndex];

  // establish list of picks sepearted by packs
  const picksList = [];
  let ind = 0;
  let added = 0;
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

  // find the information for the selected pack
  const [cardsInPack, picks, pack] = getPackAsSeen(draft.initial_state, seat, index, deck, seatIndex);
  const picked = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  picked.cards = [];
  addSeen(picked, seat.pickorder.slice(0, index));
  const seen = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  seen.cards = [];
  const overallPool = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  overallPool.cards = [];

  // this is an O(n^3) operation, but it should be ok
  addSeen(overallPool, deck.seats.map((item) => item.pickorder).flat());
  for (let i = 0; i <= parseInt(index, 10); i++) {
    console.log(getPackAsSeen(draft.initial_state, seat, i, deck, seatIndex));
    addSeen(seen, getPackAsSeen(draft.initial_state, seat, i, deck, seatIndex)[0]);
  }

  // load the weights for the selected pack
  const weights = [];
  for (let i = 0; i < traits.length - 2; i++) {
    weights.push({
      name: traits[i].name,
      description: traits[i].description,
      value: traits[i].weight(pack + 1, picks + 1, draft.initial_state).toFixed(2),
    });
  }

  for (const card of cardsInPack) {
    card.scores = [];
    const [score, combination] = botRatingAndCombination(
      card,
      picked,
      seen,
      draft.synergies,
      draft.initial_state,
      cardsInPack.length,
      pack + 1,
    );

    for (let i = 0; i < traits.length - 2; i++) {
      card.scores.push(traits[i].function(combination, card, picked, draft.synergies, overallPool, seen));
    }
    card.scores.push(combination.join(''));
    card.scores.push(score.toFixed(2));
  }

  const counts = useMemo(() => {
    const res = [];

    for (const card of cardsInPack) {
      const row = { card };
      for (let i = 0; i < card.scores.length; i++) {
        row[traits[i].name] = card.scores[i];
      }
      res.push(row);
    }
    return res;
  }, [cardsInPack, traits]);
  console.log(counts);

  const { items, requestSort, sortConfig } = useSortableData(counts);

  return (
    <>
      <h4>Pick Order</h4>
      <Row>
        {picksList.map((list, listindex) => (
          <Col xs={6} sm={3}>
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
          </Col>
        ))}
      </Row>
      <h4>{`Pack ${pack + 1}: Pick ${picks + 1} Cards`}</h4>
      <Table bordered responsive className="small-table mt-lg-3">
        <thead>
          <tr>
            <td />
            {traits.map((trait) => (
              <HeaderCell
                label={trait.name}
                fieldName={trait.name}
                sortConfig={sortConfig}
                requestSort={requestSort}
                tooltip={trait.description}
              />
            ))}
          </tr>
        </thead>
        <tbody className="breakdown">
          {items.map((item) => (
            <tr key={item.card.details.cardID}>
              <th scope="col">
                <AutocardItem key={item.card.index} card={item.card} data-in-modal index={item.card.index}>
                  <a href={`/tool/card/${encodeName(item.card.cardID)}`} target="_blank" rel="noopener noreferrer">
                    {item.card.details.name}
                  </a>
                </AutocardItem>
              </th>
              {traits.map((trait) => (
                <td key={trait.name}>{item[trait.name]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <h4>{`Pack ${pack + 1}: Pick ${picks + 1} Weights`}</h4>
      <Row>
        <Col xs={6}>
          <Table bordered className="small-table">
            <tbody className="breakdown">
              {weights.map((weight) => (
                <tr key={weight.name}>
                  <th>
                    <Tooltip text={weight.description}>{weight.name}</Tooltip>
                  </th>
                  <td>{weight.value}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
    </>
  );
};

DraftbotBreakdown.propTypes = {
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.array)).isRequired,
    synergies: PropTypes.shape({}).isRequired,
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
