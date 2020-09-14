import React from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';
import PropTypes from 'prop-types';

import { getTCGLink } from 'utils/Affiliate';

import MagicMarkdown from 'components/MagicMarkdown';
import MassBuyButton from 'components/MassBuyButton';

const compareCards = (x, y) => x.details.name.localeCompare(y.details.name);
const sortCards = (cards) => [...cards].sort(compareCards);

const dedupeCards = (cards) => {
  const map = new Map();
  for (const card of [...cards].reverse()) {
    map.set(card.details.name, card);
  }
  return [...map.values()];
};

const Tokens = ({ cube }) => {
  const positioned = cube.cards.map((card, index) => ({ ...card, position: index }));
  const byOracleId = {};
  for (const card of positioned) {
    for (const token of card.details.tokens || []) {
      const oracleId = token.details.oracle_id;
      if (!byOracleId[oracleId]) {
        byOracleId[oracleId] = {
          token,
          cards: [],
        };
      }
      // TODO: Use most recent printing for this oracle ID.
      byOracleId[oracleId].cards.push(card);
    }
  }

  const sorted = [...Object.entries(byOracleId)];
  sorted.sort((x, y) => compareCards(x[1].token, y[1].token));
  const data = sorted.map(([, tokenData]) => ({
    card: tokenData.token,
    cardDescription: sortCards(dedupeCards(tokenData.cards))
      .map(({ position }) => `[[${cube.cards[position].details.name}|${cube.cards[position].details._id}]]`)
      .join('\n\n'),
  }));

  return (
    <>
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
    </>
  );
};

Tokens.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(
      PropTypes.shape({
        details: PropTypes.shape({
          _id: PropTypes.string.isRequired,
          name: PropTypes.string.isRequired,
        }).isRequired,
      }),
    ),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
};
export default Tokens;
