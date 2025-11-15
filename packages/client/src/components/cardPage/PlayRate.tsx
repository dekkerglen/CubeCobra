import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { CardBody } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import PlayRateGraph from 'components/PlayRateGraph';

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
}

interface rateProps {
  rate: [number, number];
}

const Rate: React.FC<rateProps> = ({ rate }) => {
  return (
    <Text>
      {rate[1] === 0 ? '0.00%' : `${((rate[0] / rate[1]) * 100).toFixed(2)}%`}
      <Text sm className="text-text-secondary ml-1">
        {`(${rate[0]} / ${rate[1]})`}
      </Text>
    </Text>
  );
};
const CardBreakdownInfo: React.FC<CardPageProps> = ({ card, history }) => {
  return (
    <CardBody>
      {history.length > 1 ? (
        <>
          <PlayRateGraph defaultHistories={history} cardId={card.oracle_id} />
          <Row className="pt-2">
            <Col xs={12} md={6}>
              <Text semibold lg>
                By Legality:
              </Text>
              <Table
                rows={[
                  { label: 'Vintage', value: <Rate rate={history[history.length - 1].vintage || [0, 0]} /> },
                  { label: 'Legacy', value: <Rate rate={history[history.length - 1].legacy || [0, 0]} /> },
                  { label: 'Modern', value: <Rate rate={history[history.length - 1].modern || [0, 0]} /> },
                  { label: 'Peasant', value: <Rate rate={history[history.length - 1].peasant || [0, 0]} /> },
                  { label: 'Pauper', value: <Rate rate={history[history.length - 1].pauper || [0, 0]} /> },
                ]}
              />
            </Col>
            <Col xs={12} md={6}>
              <Text semibold lg>
                By Size:
              </Text>
              <Table
                rows={[
                  { label: '1-180', value: <Rate rate={history[history.length - 1].size180 || [0, 0]} /> },
                  { label: '181-360', value: <Rate rate={history[history.length - 1].size360 || [0, 0]} /> },
                  { label: '361-450', value: <Rate rate={history[history.length - 1].size450 || [0, 0]} /> },
                  { label: '451-540', value: <Rate rate={history[history.length - 1].size540 || [0, 0]} /> },
                  { label: '541+', value: <Rate rate={history[history.length - 1].size720 || [0, 0]} /> },
                ]}
              />
            </Col>
          </Row>
        </>
      ) : (
        <p>No play data available.</p>
      )}
    </CardBody>
  );
};

export default CardBreakdownInfo;
