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
  rate?: [number, number];
}

const Rate: React.FC<rateProps> = ({ rate }) => {
  if (!rate || rate[1] === 0) {
    return <Text className="text-text-secondary">No data</Text>;
  }

  return (
    <Text>
      {`${((rate[0] / rate[1]) * 100).toFixed(2)}%`}
      <Text sm className="text-text-secondary ml-1">
        {`(${rate[0]} / ${rate[1]})`}
      </Text>
    </Text>
  );
};
const CardBreakdownInfo: React.FC<CardPageProps> = ({ card, history }) => {
  const latest = history[history.length - 1];

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
                  { label: 'Vintage', value: <Rate rate={latest.vintage} /> },
                  { label: 'Legacy', value: <Rate rate={latest.legacy} /> },
                  { label: 'Modern', value: <Rate rate={latest.modern} /> },
                  { label: 'Pioneer', value: <Rate rate={latest.pioneer} /> },
                  { label: 'Peasant', value: <Rate rate={latest.peasant} /> },
                  { label: 'Pauper', value: <Rate rate={latest.pauper} /> },
                ]}
              />
            </Col>
            <Col xs={12} md={6}>
              <Text semibold lg>
                By Size:
              </Text>
              <Table
                rows={[
                  { label: '1-180', value: <Rate rate={latest.size180} /> },
                  { label: '181-360', value: <Rate rate={latest.size360} /> },
                  { label: '361-450', value: <Rate rate={latest.size450} /> },
                  { label: '451-540', value: <Rate rate={latest.size540} /> },
                  { label: '541+', value: <Rate rate={latest.size720} /> },
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
