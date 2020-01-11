import React, { Component } from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';

import Affiliate from '../util/Affiliate';

import MagicMarkdown from './MagicMarkdown';
import MassBuyButton from './MassBuyButton';
import withAutocard from './WithAutocard';

const AutocardLink = withAutocard('a');

const AnalyticsCardGrid = ({ data, title, cube }) => (
  <>
    <Row>
      <Col>
        <h4 className="d-lg-block d-none">{title}</h4>
      </Col>
    </Row>
    <Row className="mb-3">
      <Col>
        <MassBuyButton color="success" cards={data['cards'].map(({ card }) => card)}>
          <MagicMarkdown markdown={data['massBuyLabel']} />
        </MassBuyButton>
      </Col>
    </Row>
    <Row>
      {data['cards'].map(({ card, cardDescription }) => (
        <Col key={card.cardID} xs={6} md={4} lg={3}>
          <Card className="mb-3">
            <a href={Affiliate.getTCGLink(card)}>
              <img src={card.details.image_normal} className="card-img-top" />
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

export default AnalyticsCardGrid;
