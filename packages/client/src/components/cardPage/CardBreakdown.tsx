import React from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import { Card } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import { TabContent, Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import useQueryParam from 'hooks/useQueryParam';

import CardBreakdownElo from './Elo';
import CardBreakdownInfo from './Info';
import CardBreakdownPlayRate from './PlayRate';
import CardBreakdownStats from './Stats';

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
}

const CardBreakdown: React.FC<CardPageProps> = ({ card, history }) => {
  const [selectedTab, setSelectedTab] = useQueryParam('tab', '0');

  return (
    <Card>
      <div className="border-b border-border pt-2 px-4">
        <Flexbox direction="row" justify="between" alignItems="end">
          <Flexbox direction="col">
            <Text xl semibold>
              {card.name}
            </Text>
            <Link href={`/tool/searchcards?f=${encodeURIComponent(`set=${card.set}`)}`}>
              <Text sm semibold>{`${card.set_name} [${card.set.toUpperCase()}-${card.collector_number}]`}</Text>
            </Link>
          </Flexbox>
          <Tabs
            tabs={[
              {
                label: 'Card',
                onClick: () => setSelectedTab('0'),
              },
              {
                label: 'Elo',
                onClick: () => setSelectedTab('1'),
              },
              {
                label: 'Play Rate',
                onClick: () => setSelectedTab('2'),
              },
            ]}
            activeTab={parseInt(selectedTab || '0', 10)}
          />
        </Flexbox>
      </div>
      <Row gutters={0}>
        <Col xs={12} md={5} xl={4} xxl={3}>
          <CardBreakdownStats card={card} history={history} />
        </Col>
        <Col xs={12} md={7} xl={8} xxl={9}>
          <TabContent
            contents={[
              <CardBreakdownInfo card={card} history={history} key="info" />,
              <CardBreakdownElo card={card} history={history} key="elo" />,
              <CardBreakdownPlayRate card={card} history={history} key="playrate" />,
            ]}
            activeTab={parseInt(selectedTab || '0', 10)}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default CardBreakdown;
