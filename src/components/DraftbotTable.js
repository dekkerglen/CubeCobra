import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';
import { ListGroupItem, Table } from 'reactstrap';

import { encodeName } from 'utils/Card';
import useSortableData from 'hooks/UseSortableData';
import HeaderCell from 'components/HeaderCell';
import withAutocard from 'components/WithAutocard';
import { getPickState, getScores } from 'utils/draftbots';

const AutocardItem = withAutocard(ListGroupItem);

// arguments (colors, card, picked, draft.synergies, seen, lands, pickedInCombination, probabilities)
const TRAITS = [
  {
    name: 'Quality',
    description: 'The rating based on Elo.',
    function: (item) => Math.round(item.quality * 100),
  },
  {
    name: 'Synergy',
    description: 'A score of how well current picks synergize with this card.',
    function: (item) => Math.round(item.synergy * 100),
  },
  {
    name: 'Color',
    description: 'A score of how well this card fits within the colors drafted.',
    function: (item) => Math.round(item.color * 100),
  },
  {
    name: 'Openess',
    description: 'A score of how open the colors of this card is.',
    function: (item) => Math.round(item.openess * 100),
  },
  {
    name: 'Fixing',
    description: 'A score of how well this card is able to fix our current mana.',
    function: (item) => Math.round(item.fixing * 100),
  },
  {
    name: 'Total',
    description: 'The total calculated score.',
    function: (item) => Math.round(item.score * 100),
  },
];

const DraftbotTable = ({ draft, seatIndex, pickIndex }) => {
  const { cardsInPack, seen, picked } = getPickState(draft, seatIndex, pickIndex);
  const ratedPicks = getScores(draft.cardList, cardsInPack, picked, seen);

  const counts = useMemo(() => {
    const res = [];

    for (const card of ratedPicks) {
      const row = { card: draft.cardList[card.cardIndex] };
      for (const trait of TRAITS) {
        row[trait.name] = trait.function(card);
      }
      res.push(row);
    }
    return res;
  }, [ratedPicks, draft.cardList]);

  const { items, requestSort, sortConfig } = useSortableData(counts, { key: 'Total', direction: 'descending' });

  return (
    <>
      <h4>Breakdown</h4>
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
                <AutocardItem key={item.card._id} card={item.card} data-in-modal index={item.card.index}>
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
    </>
  );
};

DraftbotTable.propTypes = {
  draft: DraftPropType.isRequired,
  seatIndex: PropTypes.number.isRequired,
  pickIndex: PropTypes.number.isRequired,
};

export default DraftbotTable;
