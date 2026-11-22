import React from 'react';

import Card from '@utils/datatypes/Card';

import CardStacksView from 'components/cube/CardStacksView';
import CurveView from 'components/cube/CurveView';
import TableView from 'components/cube/TableView';
import VisualSpoiler from 'components/cube/VisualSpoiler';

interface CubeCardsViewProps {
  view: string;
  cards: Card[];
}

/** Draws cards in one of the cube's read-only views; unknown views fall back to the table. */
const CubeCardsView: React.FC<CubeCardsViewProps> = ({ view, cards }) => {
  switch (view) {
    case 'spoiler':
      return <VisualSpoiler cards={cards} />;
    case 'curve':
      return <CurveView cards={cards} />;
    case 'stacks':
      return <CardStacksView cards={cards} formatLabel={(label, count) => `${label} (${count})`} />;
    default:
      return <TableView cards={cards} />;
  }
};

export default CubeCardsView;
