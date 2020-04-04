import React from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';
import PropTypes from 'prop-types';

import { getTCGLink } from 'utils/Affiliate';

import MagicMarkdown from 'components/MagicMarkdown';
import MassBuyButton from 'components/MassBuyButton';

const compareCards = (x, y) => {
  if (x.details.name === y.details.name) {
    return 0;
  }
  return x.details.name < y.details.name ? -1 : 1;
};

const compareTokens = (x, y) => compareCards(x.token, y.token);

const sortTokens = (tokens) => [...tokens].sort(compareTokens);
const sortCards = (cards) => [...cards].sort(compareCards);

const dedupeCards = (cards) => {
  const map = new Map();
  for (const card of [...cards].reverse()) {
    map.set(card.details.name, card);
  }
  return [...map.values()];
};

const Tokens = ({ cards, cube }) => {
  const mentionedTokens = [];
  cards.forEach((card, position) => {
    card.position = position;
    if (card.details.tokens) {
      mentionedTokens.push(...card.details.tokens.map(({ token }) => ({ token, sourceCard: { ...card } })));
    }
  });

  const resultingTokens = [];
  mentionedTokens.forEach((element) => {
    const relevantIndex = resultingTokens.findIndex(({ token }) => token.cardID === element.token.cardID);
    if (relevantIndex >= 0) {
      resultingTokens[relevantIndex].related.push(element.sourceCard);
    } else {
      resultingTokens.push({ token: element.token, related: [element.sourceCard] });
    }
  });
  const data = sortTokens(resultingTokens).map(({ token, related }) => ({
    card: token,
    cardDescription: sortCards(dedupeCards(related))
      .map(({ position }) => `[[${position}]]`)
      .join('\n\n'),
  }));

  console.log(data);

  return (
    <Col xs="12" lg="10">
      <h4>Tokens</h4>
      <p>All the tokens and emblems your cube uses and what cards require each of them.</p>
      <Row className="mb-3">
        <Col>
          <MassBuyButton color="success" cards={data.map(({ card }) => card)}>
            Buy All Tokens
          </MassBuyButton>
        </Col>
      </Row>
      <Row>
        {data.map(({ card, cardDescription }) => (
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
    </Col>
  );
};

Tokens.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
export default Tokens;
