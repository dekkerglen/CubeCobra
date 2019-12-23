import React, { Component } from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';

import Affiliate from '../util/Affiliate';

import MassBuyButton from './MassBuyButton';
import withAutocard from './WithAutocard';

const AutocardLink = withAutocard('a');

const compareCards = (x, y) => {
  if (x.name === y.name) {
    return 0;
  } else {
    return x.name < y.name ? -1 : 1;
  }
};

const compareTokens = (x, y) => compareCards(x[0], y[0]);

const sortTokens = (tokens) => [...tokens].sort(compareTokens);
const sortCards = (cards) => [...cards].sort(compareCards);

const dedupeCards = (cards) => {
  const map = new Map();
  for (const card of [...cards].reverse()) {
    map.set(card.name, card);
  }
  return [...map.values()];
};

const TokenAnalysis = ({ tokens }) => (
  <>
    <Row className="mb-3">
      <Col>
        <MassBuyButton color="success" cards={tokens.map(([token, tokenCards]) => ({ details: token }))}>
          Buy all tokens
        </MassBuyButton>
      </Col>
    </Row>
    <Row>
      {sortTokens(tokens).map(([token, tokenCards]) => (
        <Col key={token._id} xs={6} md={4} lg={3}>
          <Card className="mb-3">
            <a href={'/tool/card/' + token._id}>
              <img src={token.image_normal} className="card-img-top" />
            </a>
            <CardBody>
              <p className="card-text">
                {dedupeCards(sortCards(tokenCards)).map((card) => (
                  <>
                    <AutocardLink key={card.name} href={'/tool/card/' + card._id} card={{ details: card }}>
                      {card.name}
                    </AutocardLink>
                    <br />
                  </>
                ))}
              </p>
            </CardBody>
          </Card>
        </Col>
      ))}
    </Row>
  </>
);

export default TokenAnalysis;
