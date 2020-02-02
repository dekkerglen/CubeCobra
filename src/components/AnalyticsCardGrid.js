import React from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';
import PropTypes from 'prop-types';

import { getTCGLink } from 'utils/Affiliate';

import MagicMarkdown from 'components/MagicMarkdown';
import MassBuyButton from 'components/MassBuyButton';

// Data should be:
// {
//   type: 'cardGrid',
//   description: str,
//   massBuyLabel: str,
//   cards: [
//     {
//       card: Card,
//       cardDescription: str,
//     }
//    ],
// }
const AnalyticsCardGrid = ({ data, cube }) => (
  <>
    <Row className="mb-3">
      <Col>
        <MassBuyButton color="success" cards={data.cards.map(({ card }) => card)}>
          <MagicMarkdown markdown={data.massBuyLabel} />
        </MassBuyButton>
      </Col>
    </Row>
    <Row>
      {data.cards.map(({ card, cardDescription }) => (
        <Col key={card.cardID} xs={6} md={4} lg={3}>
          <Card className="mb-3">
            <a href={getTCGLink(card)}>
              <img src={card.details.image_normal} className="card-img-top" alt={card.details.name} />
            </a>
            <CardBody>
              <p className="card-text">
                <MagicMarkdown markdown={cardDescription} cube={cube} />
              </p>
            </CardBody>
          </Card>
        </Col>
      ))}
    </Row>
  </>
);

AnalyticsCardGrid.propTypes = {
  data: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object).isRequired,
    massBuyLabel: PropTypes.string.isRequired,
  }).isRequired,
  cube: PropTypes.shape({}).isRequired,
};

export default AnalyticsCardGrid;
