import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, ListGroup, ListGroupItem } from 'reactstrap';

import { SortableTable, compareStrings } from 'components/SortableTable';
import Tooltip from 'components/Tooltip';
import withAutocard from 'components/WithAutocard';
import { getCardColorClass } from 'contexts/TagContext';
import useQueryParam from 'hooks/useQueryParam';
import DeckPropType from 'proptypes/DeckPropType';
import { DrafterStatePropType } from 'proptypes/DraftbotPropTypes';
import { encodeName } from 'utils/Card';
import { evaluateCardOrPool, ORACLES_BY_NAME } from 'utils/draftbots';
import { fromEntries } from 'utils/Util';

const AutocardItem = withAutocard(ListGroupItem);

const CARD_TRAIT = Object.freeze({
  title: 'Card',
  tooltip: 'The card the bot is considering',
  compute: ({ card }) => card,
  heading: true,
  renderFn: (card) => (
    <AutocardItem key={card.index} card={card} data-in-modal index={card.index}>
      <a href={`/tool/card/${encodeName(card.cardID)}`} target="_blank" rel="noopener noreferrer">
        {card.details.name}
      </a>
    </AutocardItem>
  ),
});
const TRAITS = Object.freeze([
  {
    title: 'Casting Probability',
    tooltip:
      'How likely we are to play this card on curve if we have enough lands. Applies as scaling to Rating and Pick Synergy.',
    compute: ({ probability }) => probability,
  },
  {
    title: 'Lands',
    tooltip: 'This is the color combination the bot is assuming that will maximize the total score.',
    compute: ({ lands }) => JSON.stringify(lands),
  },
  {
    title: 'Total Score',
    tooltip: 'The total calculated score.',
    compute: ({ score }) => score,
  },
]);

const renderWithTooltip = (title) => <Tooltip text={ORACLES_BY_NAME[title].tooltip}>{title}</Tooltip>;

const WEIGHT_COLUMNS = Object.freeze([
  { title: 'Oracle', sortable: true, key: 'title', heading: true, renderFn: renderWithTooltip },
  { title: 'Weight', sortable: true, key: 'weight' },
]);

export const DraftbotBreakdownTable = ({ drafterState }) => {
  // const [normalized, toggleNormalized] = useToggle(false);
  const botEvaluations = useMemo(
    () =>
      drafterState.cardsInPack.map((card) => ({
        ...evaluateCardOrPool(card, drafterState),
        card: drafterState.cards[card],
      })),
    [drafterState],
  );
  const oracles = useMemo(() => botEvaluations[0].oracleResults.map(({ title, tooltip }) => ({ title, tooltip })), [
    botEvaluations,
  ]);
  const weights = useMemo(() => botEvaluations[0].oracleResults.map(({ title, weight }) => ({ title, weight })), [
    botEvaluations,
  ]);
  const rows = useMemo(
    () =>
      botEvaluations.map((botEvaluation) =>
        fromEntries([
          [CARD_TRAIT.title, CARD_TRAIT.compute(botEvaluation)],
          ...botEvaluation.oracleResults.map(({ title, value }) => [title, value]),
          ...TRAITS.map(({ title, compute }) => [title, compute(botEvaluation)]),
        ]),
      ),
    [botEvaluations],
  );

  return (
    <>
      {/* <Label check className="pl-4 mb-2">
            <Input type="checkbox" onClick={toggleNormalized} /> Normalize the columns so the lowest value is 0.00
           </Label>
      */}
      <SortableTable
        className="small-table"
        columnProps={[CARD_TRAIT, ...oracles, ...TRAITS].map((trait) => ({
          ...trait,
          key: trait.title,
          sortable: true,
        }))}
        data={rows}
        defaultSortConfig={{ key: 'Total', direction: 'descending' }}
        sortFns={{ Lands: compareStrings, Card: (a, b) => compareStrings(a.details.name, b.details.name) }}
      />
      <h4 className="mt-4 mb-2">{`Pack ${drafterState.packNum + 1}: Pick ${drafterState.pickNum + 1} Weights`}</h4>
      <SortableTable
        className="small-table"
        columnProps={WEIGHT_COLUMNS}
        data={weights}
        sortFns={{ title: compareStrings }}
      />
    </>
  );
};

DraftbotBreakdownTable.propTypes = {
  drafterState: DrafterStatePropType.isRequired,
};

const DraftbotBreakdown = ({ draft, seatIndex, deck, defaultIndex }) => {
  const [index, setIndex] = useQueryParam('pick', defaultIndex ?? 0);

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
  const picked = seat.pickorder.slice(0, index);

  const seen = useMemo(() => {
    const res = [];
    // this is an O(n^3) operation, but it should be ok
    for (let i = 0; i <= parseInt(index, 10); i++) {
      res.push(getPackAsSeen(draft.initial_state, i, deck, seatIndex)[0]);
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
      <DraftbotBreakdownTable
        cardsInPack={cardsInPack}
        draft={draft}
        pack={pack}
        picks={picks}
        picked={picked}
        seen={seen}
      />
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
