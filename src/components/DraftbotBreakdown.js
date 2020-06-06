import React, { useEffect, useRef, useState } from 'react';

import { Row, Col, ListGroup, ListGroupItem, Table } from 'reactstrap';

import withAutocard from 'components/WithAutocard';
import Tooltip from 'components/Tooltip';
import PropTypes from 'prop-types';
import { encodeName, COLOR_COMBINATIONS } from 'utils/Card';
import { addSeen } from 'utils/Draft';
import { fromEntries } from 'utils/Util';
import { getCardColorClass } from 'components/TagContext';

import Query from 'utils/Query';
import {
  getRating,
  getColor,
  getSynergy,
  getOpenness,
  getFormatInfluence,
  getFixing,
  getRatingWeight,
  getSynergyWeight,
  getOpennessWeight,
  getColorWeight,
  getFixingWeight,
  getFormatInfluenceWeight,
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
      function: (combination, card, picked, synergies, overallPool, seen) => getRating(combination, card),
    },
    {
      name: 'Synergy',
      description: 'A score of how well this card synergizes with the current picks.',
      weight: getSynergyWeight,
      function: (combination, card, picked, synergies, overallPool, seen) =>
        getSynergy(combination, card, picked, synergies),
    },
    {
      name: 'Openness',
      description: 'A score of how open these colors appear to be.',
      weight: getOpennessWeight,
      function: (combination, card, picked, synergies, overallPool, seen) =>
        getOpenness(combination, seen, overallPool),
    },
    {
      name: 'Color',
      description: 'A score of how well these colors fit in with the current picks.',
      weight: getColorWeight,
      function: (combination, card, picked, synergies, overallPool, seen) => getColor(combination),
    },
    {
      name: 'Fixing',
      description: 'The value of how well this card solves mana issues.',
      weight: getFixingWeight,
      function: (combination, card, picked, synergies, overallPool, seen) => getFixing(),
    },
    {
      name: 'Format',
      description: 'The influence of how well these colors fit into this format.',
      weight: getFormatInfluenceWeight,
      function: (combination, card, picked, synergies, overallPool, seen) =>
        getFormatInfluence(combination, overallPool),
    },
    {
      name: 'Combination',
      description: 'This is the color combination the bot is assuming all the previous values on.',
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

  if (!draft) {
    return <h4>This deck does not have a related draft log.</h4>;
  }

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
  addSeen(picked, seat.pickorder.slice(0, picks));
  const seen = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  seen.cards = [];
  const overallPool = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  overallPool.cards = [];

  // this is an O(n^3) operation, but it should be ok
  addSeen(overallPool, deck.seats.map((item) => item.pickorder).flat());
  for (let i = 0; i < parseInt(index, 10); i++) {
    addSeen(seen, getPackAsSeen(draft.initial_state, seat, i, deck, seatIndex)[0]);
  }

  // load the weights for the selected pack
  const weights = [];
  for (let i = 0; i < traits.length - 2; i++) {
    weights.push({
      name: traits[i].name,
      description: traits[i].description,
      value: traits[i].weight(pack + 1, picks + 1, draft.initial_state),
    });
  }

  for (const card of cardsInPack) {
    card.scores = [];

    const [score, combination] = botRatingAndCombination(
      card,
      picked,
      seen,
      overallPool,
      draft.synergies,
      draft.initial_state,
      cardsInPack.length,
      pack + 1,
    );

    for (let i = 0; i < traits.length - 2; i++) {
      card.scores.push(traits[i].function(combination, card, picked, draft.synergies, overallPool, seen).toFixed(2));
    }
    card.scores.push(combination);
    card.scores.push(score.toFixed(2));
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
        <h4>{`Pack ${pack + 1}: Pick ${picks + 1} Cards`}</h4>
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
                    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer">
                      {card.details.name}
                    </a>
                  </AutocardItem>
                </th>
                {traits.map((trait, traitIndex) => (
                  <td key={trait.name}>{card.scores[traitIndex]}</td>
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
      </Col>
    </Row>
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
