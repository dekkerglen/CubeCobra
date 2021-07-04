import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { SortableTable } from 'components/SortableTable';
import { DrafterStatePropType } from 'proptypes/DraftbotPropTypes';
import { addCardContext, scores } from 'drafting/heuristics';
import CardPropType from 'proptypes/CardPropType';

const DraftbotBreakdownTable = ({ drafterState, cards }) => {
  console.log(drafterState);

  const botEvaluations = useMemo(() => {
    addCardContext(cards);
    return drafterState.cardsInPack.map((index) => {
      const card = cards[index];
      return {
        name: card.details.name,
        ...scores({
          card: card.cardID,
          picked: drafterState.picked.map((idx) => drafterState.cards[idx].cardID),
          seen: drafterState.seen.map((idx) => drafterState.cards[idx].cardID),
        }),
      };
    });
  }, [cards, drafterState]);

  const columnProps = Object.entries(botEvaluations[0]).map(([key]) => ({
    key,
    title: key,
    heading: true,
    sortable: true,
  }));

  return (
    <>
      <SortableTable className="small-table" columnProps={columnProps} data={botEvaluations} />
    </>
  );
};

DraftbotBreakdownTable.propTypes = {
  drafterState: DrafterStatePropType.isRequired,
  cards: PropTypes.arrayOf(CardPropType).isRequired,
};

export default DraftbotBreakdownTable;
