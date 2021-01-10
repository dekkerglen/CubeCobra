import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Input, Label, ListGroup, ListGroupItem, Table } from 'reactstrap';

import HeaderCell from 'components/HeaderCell';
import Tooltip from 'components/Tooltip';
import withAutocard from 'components/WithAutocard';
import { getCardColorClass } from 'contexts/TagContext';
import useQueryParam from 'hooks/useQueryParam';
import useSortableData from 'hooks/UseSortableData';
import useToggle from 'hooks/UseToggle';
import DeckPropType from 'proptypes/DeckPropType';
import { encodeName } from 'utils/Card';
import { addSeen, createSeen, init } from 'utils/Draft';
import {
  botRatingAndCombination,
  getColor,
  getColorWeight,
  getFixing,
  getFixingWeight,
  getInternalSynergy,
  getOpenness,
  getOpennessWeight,
  getPickSynergy,
  getRating,
  getRatingWeight,
  getSynergyWeight,
  getCastingProbability,
  PROB_TO_INCLUDE,
} from 'utils/draftbots';
import { fromEntries } from 'utils/Util';

const AutocardItem = withAutocard(ListGroupItem);

export const getPackAsSeen = (initialState, index, deck, seatIndex) => {
  const cardsInPack = [];

  let start = 0;
  let end = initialState[0][0].cards.length;
  let pack = 0;
  let current = parseInt(seatIndex, 10);
  let picks = parseInt(index, 10);

  while (picks >= initialState[0][pack].cards.length - initialState[0][pack].trash) {
    start = end;
    end += initialState[0][pack].cards.length - initialState[0][pack].trash;
    picks -= initialState[0][pack].cards.length - initialState[0][pack].trash;
    pack += 1;
  }
  for (let i = start + picks; i < end; i += 1) {
    cardsInPack.push(deck.cards[deck.seats[current].pickorder[i]]);
    if (!initialState[0][pack].sealed && (i + 1) % initialState[0][pack].pickAtTime === 0) {
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
  }

  // establish list of picks sepearted by packs
  const seat = deck.seats[seatIndex];
  const picksList = [];
  let ind = 0;
  let added = 0;
  for (const list of initialState[0]) {
    const newAdded = added + list.cards.length;
    picksList.push(seat.pickorder.slice(added, newAdded).map((ci) => ({ ...deck.cards[ci] })));
    added = newAdded;
  }
  for (const list of picksList) {
    for (const card of list) {
      card.index = ind;
      ind += 1;
    }
  }

  return [cardsInPack, picks, pack, picksList, seat];
};

// arguments (colors, card, picked, draft.synergies, seen, lands, pickedInCombination, probabilities)
const TRAITS = [
  {
    name: 'Rating',
    description: 'The rating based on the Elo and current color commitments.',
    weight: getRatingWeight,
    function: (_0, card, _1, cards) => getRating(card, cards),
  },
  {
    name: 'Internal Synergy',
    description: 'A score of how well current picks in these colors synergize with each other.',
    weight: getSynergyWeight,
    function: (_0, _1, picked, cards, _2, _3, pickedInCombination) =>
      getInternalSynergy(pickedInCombination, picked, cards),
  },
  {
    name: 'Pick Synergy',
    description: 'A score of how well this card synergizes with the current picks.',
    weight: getSynergyWeight,
    function: (_0, card, picked, cards, _1, _2, pickedInCombination) =>
      getPickSynergy(pickedInCombination, card, picked, cards),
  },
  {
    name: 'Openness',
    description: 'A score of how open these colors appear to be.',
    weight: getOpennessWeight,
    function: (combination, _0, _1, _2, seen) => getOpenness(combination, seen),
  },
  {
    name: 'Color',
    description: 'A score of how well these colors fit in with the current picks.',
    weight: getColorWeight,
    function: (_0, _1, picked, cards, _2, _3, pickedInCombination, probabilities) =>
      getColor(pickedInCombination, picked, probabilities, cards),
  },
  {
    name: 'Fixing',
    description: 'The value of how well this card solves mana issues.',
    weight: getFixingWeight,
    function: (combination, card, _, cards) => getFixing(combination, card, cards),
  },
  {
    name: 'Casting Probability',
    description:
      'How likely we are to play this card on curve if we have enough lands. Applies as scaling to Rating and Pick Synergy.',
    function: (_0, card, _1, cards, _2, lands) => getCastingProbability(cards[card], lands),
  },
  {
    name: 'Lands',
    description: 'This is the color combination the bot is assuming that will maximize the total score.',
  },
  {
    name: 'Total',
    description: 'The total calculated score.',
  },
];

export const Internal = ({ cardsInPack, draft, pack, picks, picked, seen }) => {
  const weights = useMemo(() => {
    const res = [];
    for (let i = 0; i < TRAITS.length - 3; i++) {
      res.push({
        name: TRAITS[i].name,
        description: TRAITS[i].description,
        value: TRAITS[i].weight(pack + 1, picks + 1, draft.initial_state).toFixed(2),
      });
    }
    return res;
  }, [draft, pack, picks]);
  const [normalized, toggleNormalized] = useToggle(false);

  for (const card of cardsInPack) {
    card.scores = [];
    const { rating, colors, lands } = botRatingAndCombination(
      draft.cards,
      card.index,
      picked,
      seen,
      draft.initial_state,
      cardsInPack.length,
      pack + 1,
    );
    const probabilities = {};
    for (const c of picked.cards.WUBRG) {
      probabilities[c.cardID] = getCastingProbability(c, lands);
    }
    const pickedInCombination = picked.cards.WUBRG.filter((c) => probabilities[c.cardID] > PROB_TO_INCLUDE);

    for (let i = 0; i < TRAITS.length - 2; i++) {
      card.scores.push(
        TRAITS[i].function(colors, card.index, picked, draft.cards, seen, lands, pickedInCombination, probabilities),
      );
    }
    card.scores.push(JSON.stringify(fromEntries(Object.entries(lands).filter(([, c]) => c))));
    card.scores.push(rating.toFixed(2));
  }
  if (normalized) {
    for (let i = 0; i < TRAITS.length - 2; i++) {
      let minScore = cardsInPack[0].scores[i];
      let maxScore = cardsInPack[0].scores[i];
      for (const card of cardsInPack) {
        if (card.scores[i] < minScore) {
          minScore = card.scores[i];
        }
        if (card.scores[i] > maxScore) {
          maxScore = card.scores[i];
        }
      }
      for (const card of cardsInPack) {
        card.scores[i] = `+${(card.scores[i] - minScore).toFixed(2)}`;
      }
    }
  } else {
    for (let i = 0; i < TRAITS.length - 2; i++) {
      for (const card of cardsInPack) {
        card.scores[i] = card.scores[i].toFixed(2);
      }
    }
  }

  const counts = useMemo(() => {
    const res = [];

    for (const card of cardsInPack) {
      const row = { card };
      for (let i = 0; i < card.scores.length; i++) {
        row[TRAITS[i].name] = card.scores[i];
      }
      res.push(row);
    }
    return res;
  }, [cardsInPack]);

  const { items, requestSort, sortConfig } = useSortableData(counts, { key: 'Total', direction: 'descending' });

  return (
    <>
      <Label check className="pl-2">
        <Input type="checkbox" onClick={toggleNormalized} /> Normalize the Columns
      </Label>
      <Table bordered responsive className="small-table mt-lg-3">
        <thead>
          <tr>
            <td />
            {TRAITS.map((trait) => (
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
              {TRAITS.map((trait) => (
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
                    <Tooltip
                      id={`DraftbotBreakdownWeightID_${weight.name.replace(' ', '_')}`}
                      text={weight.description}
                    >
                      {weight.name}
                    </Tooltip>
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

Internal.propTypes = {
  cardsInPack: PropTypes.arrayOf(PropTypes.shape({ scores: PropTypes.arrayOf(PropTypes.number).isRequired }))
    .isRequired,
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.array)).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  pack: PropTypes.number.isRequired,
  picks: PropTypes.number.isRequired,
  picked: PropTypes.shape({
    cards: PropTypes.shape({ WUBRG: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })) }).isRequired,
  }).isRequired,
  seen: PropTypes.shape({}).isRequired,
};

const DraftbotBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useQueryParam(defaultIndex ?? 0);

  // Have to do useMemo so it happens immediately
  useMemo(() => init(draft), [draft]);

  const click = useCallback(
    (event) => {
      if (index !== event.target.getAttribute('index')) {
        setIndex(event.target.getAttribute('index'));
      }
    },
    [index, setIndex],
  );

  // find the information for the selected pack
  const [cardsInPack, picks, pack, picksList, seat] = getPackAsSeen(draft.initial_state, index, deck, seatIndex);
  const picked = createSeen();
  addSeen(picked, seat.pickorder.slice(0, index), draft.cards);

  const seen = useMemo(() => {
    const res = createSeen();

    // this is an O(n^3) operation, but it should be ok
    for (let i = 0; i <= parseInt(index, 10); i++) {
      addSeen(res, getPackAsSeen(draft.initial_state, i, deck, seatIndex)[0], draft.cards);
    }
    return res;
  }, [deck, draft, index, seatIndex]);

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
      <Internal cardsInPack={cardsInPack} draft={draft} pack={pack} picks={picks} picked={picked} seen={seen} />
    </>
  );
};

DraftbotBreakdown.propTypes = {
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.array)).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  deck: DeckPropType.isRequired,
  seatIndex: PropTypes.string.isRequired,
  defaultIndex: PropTypes.number,
};

DraftbotBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DraftbotBreakdown;
