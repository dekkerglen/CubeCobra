import React, { useMemo } from 'react';
import { Card, CardBody, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';

import Markdown from 'components/Markdown';
import MassBuyButton from 'components/MassBuyButton';
import { getTCGLink } from 'utils/Affiliate';

const compareCards = (x, y) => x.details.name.localeCompare(y.details.name);
const sortCards = (cards) => [...cards].sort(compareCards);

const dedupeCards = (cards) => {
  const map = new Map();
  for (const card of [...cards].reverse()) {
    map.set(card.details.name, card);
  }
  return [...map.values()];
};

const Tokens = ({ cube, cards }) => {
  const data = useMemo(() => {
    const positioned = cards.map((card, index) => ({ ...card, position: index }));
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
    return sorted.map(([, tokenData]) => ({
      card: tokenData.token,
      cardDescription: sortCards(dedupeCards(tokenData.cards))
        .map(({ position }) => `[[${cards[position].details.name}|${cards[position].details.scryfall_id}]]`)
        .join('\n\n'),
    }));
  }, [cards]);

  return (
    <>
      <h4>Tokens</h4>
      <p>All the tokens and emblems your cube uses and what cards require each of them.</p>
      <Row className="mb-3">
        <Col>
          <MassBuyButton color="accent" cards={data.map(({ card }) => card)}>
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
                  <Markdown markdown={cardDescription} cube={cube} />
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
  cube: CubePropType.isRequired,
  cards: PropTypes.arrayOf(CardPropType).isRequired,
};
export default Tokens;
