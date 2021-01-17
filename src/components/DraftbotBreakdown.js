import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Input, Label, ListGroup, ListGroupItem } from 'reactstrap';

import { SortableTable, compareStrings } from 'components/SortableTable';
import { getCardColorClass } from 'contexts/TagContext';
import Tooltip from 'components/Tooltip';
import withAutocard from 'components/WithAutocard';
import useQueryParam from 'hooks/useQueryParam';
import useToggle from 'hooks/UseToggle';
import CardPropType from 'proptypes/CardPropType';
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

  // establish list of picks sepearted by packs
  const seat = deck.seats[seatIndex];
  const picksList = [];
  let ind = 0;
  let added = 0;
  for (const list of initialState[0]) {
    picksList.push(seat.pickorder.slice(added, added + list.length).map((c) => ({ ...c })));
    added += list.length;
  }
  for (const list of picksList) {
    for (const card of list) {
      card.index = ind;
      ind += 1;
    }
  }

  return [cardsInPack, picks, pack, picksList, seat];
};

const renderCardLink = (card) => (
  <AutocardItem key={card.index} card={card} data-in-modal index={card.index}>
    <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer">
      {card.details.name}
    </a>
  </AutocardItem>
);

// arguments (colors, card, picked, draft.synergies, seen, lands, pickedInCombination, probabilities, rating)
const TRAITS = Object.freeze([
  {
    title: 'Card',
    tooltip: 'The card the bot is considering',
    compute: (_, card) => card,
    heading: true,
    renderFn: renderCardLink,
  },
  {
    title: 'Rating',
    tooltip: 'The rating based on the Elo and current color commitments.',
    weight: getRatingWeight,
    compute: (_, card) => getRating(card),
  },
  {
    title: 'Internal Synergy',
    tooltip: 'A score of how well current picks in these colors synergize with each other.',
    weight: getSynergyWeight,
    compute: (_, __, picked, _3, ___, ____, pickedInCombination) => getInternalSynergy(pickedInCombination, picked),
  },
  {
    title: 'Pick Synergy',
    tooltip: 'A score of how well this card synergizes with the current picks.',
    weight: getSynergyWeight,
    compute: (_, card, picked, _2, __, ___, pickedInCombination) => getPickSynergy(pickedInCombination, card, picked),
  },
  {
    title: 'Openness',
    tooltip: 'A score of how open these colors appear to be.',
    weight: getOpennessWeight,
    compute: (combination, _, __, ___, seen) => getOpenness(combination, seen),
  },
  {
    title: 'Color',
    tooltip: 'A score of how well these colors fit in with the current picks.',
    weight: getColorWeight,
    compute: (_, _____, picked, __, ___, ____, pickedInCombination, probabilities) =>
      getColor(pickedInCombination, picked, probabilities),
  },
  {
    title: 'Fixing',
    tooltip: 'The value of how well this card solves mana issues.',
    weight: getFixingWeight,
    compute: (combination, card) => getFixing(combination, card),
  },
  {
    title: 'Casting Probability',
    tooltip:
      'How likely we are to play this card on curve if we have enough lands. Applies as scaling to Rating and Pick Synergy.',
    compute: (_, card, __, ___, ____, lands) => getCastingProbability(card, lands),
  },
  {
    title: 'Lands',
    tooltip: 'This is the color combination the bot is assuming that will maximize the total score.',
    compute: (_1, _2, _3, _4, _5, lands) => JSON.stringify(lands),
  },
  {
    title: 'Total',
    tooltip: 'The total calculated score.',
    compute: (_1, _2, _3, _4, _5, _6, _7, _8, rating) => rating,
  },
]);

const renderWithTooltip = (title) => (
  <Tooltip text={TRAITS.find((trait) => trait.title === title)?.tooltip}>{title}</Tooltip>
);

const WEIGHT_COLUMNS = Object.freeze([
  { title: 'Oracle', sortable: true, key: 'title', heading: true, renderFn: renderWithTooltip },
  { title: 'Weight', sortable: true, key: 'weight' },
]);

export const Internal = ({ cardsInPack, draft, pack, picks, picked, seen }) => {
  const [normalized, toggleNormalized] = useToggle(false);
  const weights = useMemo(
    () =>
      TRAITS.filter((t) => t.weight).map(({ title, tooltip, weight }) => ({
        title,
        tooltip,
        weight: weight(pack + 1, picks + 1, draft.initial_state),
      })),
    [draft, pack, picks],
  );
  const rows = useMemo(() => {
    const res = cardsInPack.map((card) => {
      const { rating, colors, lands } = botRatingAndCombination(
        card,
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
      return fromEntries(
        TRAITS.map(({ title, compute }) => [
          title,
          compute(colors, card, picked, draft.synergies, seen, lands, pickedInCombination, probabilities, rating),
        ]),
      );
    });
    if (normalized) {
      for (const { title } of TRAITS) {
        if (title !== 'Lands') {
          const minScore = Math.min(...res.map((cardScores) => cardScores[title]));
          for (const cardScores of res) {
            cardScores[title] -= minScore;
          }
        }
      }
    }
    return res;
  }, [cardsInPack, normalized, draft, pack, picked, seen]);

  return (
    <>
      <Label check className="pl-4 mb-2">
        <Input type="checkbox" onClick={toggleNormalized} /> Normalize the columns so the lowest value is 0.00
      </Label>
      <SortableTable
        className="small-table"
        columnProps={TRAITS.map((trait) => ({ ...trait, key: trait.title, sortable: true }))}
        data={rows}
        defaultSortConfig={{ key: 'Total', direction: 'descending' }}
        sortFns={{ Lands: compareStrings, Card: (a, b) => compareStrings(a.name, b.name) }}
      />
      <h4 className="mt-4 mb-2">{`Pack ${pack + 1}: Pick ${picks + 1} Weights`}</h4>
      <SortableTable
        className="small-table"
        columnProps={WEIGHT_COLUMNS}
        data={weights}
        sortFns={{ title: compareStrings }}
      />
    </>
  );
};

Internal.propTypes = {
  cardsInPack: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.array)).isRequired,
    synergies: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number.isRequired).isRequired).isRequired,
  }).isRequired,
  pack: PropTypes.number.isRequired,
  picks: PropTypes.number.isRequired,
  picked: PropTypes.shape({
    cards: PropTypes.shape({ WUBRG: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })) }).isRequired,
  }).isRequired,
  seen: PropTypes.shape({}).isRequired,
};

const DraftbotBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useQueryParam('pick', defaultIndex ?? 0);

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
  addSeen(picked, seat.pickorder.slice(0, index));

  const seen = useMemo(() => {
    const res = createSeen();

    // this is an O(n^3) operation, but it should be ok
    for (let i = 0; i <= parseInt(index, 10); i++) {
      addSeen(res, getPackAsSeen(draft.initial_state, i, deck, seatIndex)[0]);
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
      <h4 className="mt-5 mb-2">{`Pack ${pack + 1}: Pick ${picks + 1} Cards`}</h4>
      <Internal cardsInPack={cardsInPack} draft={draft} pack={pack} picks={picks} picked={picked} seen={seen} />
    </>
  );
};

DraftbotBreakdown.propTypes = {
  draft: PropTypes.shape({
    initial_state: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.array)).isRequired,
    synergies: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number.isRequired).isRequired).isRequired,
  }).isRequired,
  deck: DeckPropType.isRequired,
  seatIndex: PropTypes.string.isRequired,
  defaultIndex: PropTypes.number,
};

DraftbotBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DraftbotBreakdown;
