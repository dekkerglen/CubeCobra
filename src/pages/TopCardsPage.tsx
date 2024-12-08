import React from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';
import TimeAgo from 'react-timeago';

import Button from 'components/base/Button';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import Text from 'components/base/Text';

interface User {
  id: string;
  username: string;
}

interface CardData {
  id: string;
  name: string;
  date: string;
  user: User;
}

interface TopCardsPageProps {
  loginCallback?: string;
  cards: CardData[];
}

const TopCardsPage: React.FC<TopCardsPageProps> = ({ loginCallback = '/', cards }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <Text md semibold>
          Top Cards
        </Text>
      </CardHeader>
      {cards.map((card) => (
        <CardBody key={card.id} className="border-top">
          <Row>
            <Col xs={12} sm={8}>
              <p>{card.name}</p>
              <p>
                Added by{' '}
                <a href={`/user/view/${card.user.id}`} target="_blank" rel="noopener noreferrer">
                  {card.user.username}
                </a>
                - <TimeAgo date={card.date} />
              </p>
            </Col>
            <Col xs={12} sm={4}>
              <Button color="primary" outline block href={`/card/${card.id}`}>
                View Card
              </Button>
            </Col>
          </Row>
        </CardBody>
      ))}
    </Card>
  </MainLayout>
);

export default RenderToRoot(TopCardsPage);
