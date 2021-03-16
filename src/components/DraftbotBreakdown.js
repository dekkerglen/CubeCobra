import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, ListGroup, ListGroupItem } from 'reactstrap';

import { usePickListAndDrafterState, ACTION_LABELS } from 'components/DecksPickBreakdown';
import { SortableTable, compareStrings } from 'components/SortableTable';
import Tooltip from 'components/Tooltip';
import withAutocard from 'components/WithAutocard';
import { getCardColorClass } from 'contexts/TagContext';
import { DrafterStatePropType, DraftPropType } from 'proptypes/DraftbotPropTypes';
import { cardName, encodeName } from 'utils/Card';
import { evaluateCardsOrPool, ORACLES_BY_NAME } from 'drafting/draftbots';
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
        {cardName(card)}
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
  const botEvaluations = useMemo(
    () =>
      drafterState.cardsInPack.map((card) => ({
        ...evaluateCardsOrPool(card, drafterState),
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

const DraftbotBreakdown = (props) => {
  const { picksList, drafterState, setPickNumberFromEvent } = usePickListAndDrafterState(props);

  return (
    <>
      <h4>Pick Order</h4>
      <Row>
        {picksList.map((list, listindex) => (
          <Col xs={6} sm={3} key={/* eslint-disable-line react/no-array-index-key */ listindex}>
            <ListGroup className="list-outline">
              <ListGroupItem className="list-group-heading">{`Pack ${listindex + 1}`}</ListGroupItem>
              {list.map(({ card, action, pickNumber }) => (
                <AutocardItem
                  key={card.index}
                  card={card}
                  className={`card-list-item d-flex flex-row ${getCardColorClass(card)}`}
                  data-in-modal
                  onClick={setPickNumberFromEvent}
                  data-pick-number={pickNumber}
                >
                  {drafterState.pickNumber === pickNumber ? (
                    <strong>{`${ACTION_LABELS[action]} ${cardName(card)}`}</strong>
                  ) : (
                    <>{`${ACTION_LABELS[action]} ${cardName(card)}`}</>
                  )}
                </AutocardItem>
              ))}
            </ListGroup>
          </Col>
        ))}
      </Row>
      <h4 className="mt-5 mb-2">{`Pack ${drafterState.packNum + 1}: Pick ${drafterState.pickNum + 1} Cards`}</h4>
      <DraftbotBreakdownTable drafterState={drafterState} />
    </>
  );
};

DraftbotBreakdown.propTypes = {
  // eslint-disable-next-line
  draft: DraftPropType.isRequired,
  // eslint-disable-next-line
  seatIndex: PropTypes.number.isRequired,
  // eslint-disable-next-line
  defaultIndex: PropTypes.number,
};

DraftbotBreakdown.defaultProps = {
  defaultIndex: 0,
};

export default DraftbotBreakdown;
