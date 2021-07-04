import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { SortableTable, compareStrings } from 'components/SortableTable';
import { DrafterStatePropType } from 'proptypes/DraftbotPropTypes';
import { fromEntries } from 'utils/Util';
import { addCardContext, scores } from 'drafting/heuristics';
import CardPropType from 'proptypes/CardPropType';

const DraftbotBreakdownTable = ({ drafterState, cards }) => {
  const botEvaluations = useMemo(() => {
    addCardContext(cards);
    return drafterState.cardsInPack.map((index) => {
      const card = cards[index];
      return {
        name: card.details.name,
        ...scores({
          card: card.details._id,
          picked: [],
          seen: [],
        }),
      };
    });
  }, [cards, drafterState]);

  const columnProps = Object.entries(botEvaluations[0]).map(([key]) => ({
    key,
    title: key,
    heading: true,
    sortable: false,
  }));

  console.log(columnProps);
  console.log(botEvaluations);

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
