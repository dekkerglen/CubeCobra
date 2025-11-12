import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { CardBody } from 'components/base/Card';
import EloGraph from 'components/EloGraph';

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
}

const CardBreakdownInfo: React.FC<CardPageProps> = ({ card, history }) => {
  return (
    <CardBody>
      <EloGraph defaultHistories={history} cardId={card.oracle_id} />
    </CardBody>
  );
};

export default CardBreakdownInfo;
