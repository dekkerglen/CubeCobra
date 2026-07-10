import React from 'react';

import CardType from '@utils/datatypes/Card';

import { Col, Row } from 'components/base/Layout';
import FoilCardImage from 'components/FoilCardImage';

import CardBack from './CardBack';

interface HousmanCardRowProps {
  cards: CardType[]; // full draft card pool, indexed by card index
  indices: number[]; // card indices to render, in order
  isKnown: (cardIndex: number) => boolean; // whether the viewer can identify the card
  highlight?: number | null; // card index to visually emphasize (e.g. the last card swapped in)
  xs?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  md?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  xl?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

const HousmanCardRow: React.FC<HousmanCardRowProps> = ({ cards, indices, isKnown, highlight, xs, md, xl }) => (
  <Row className="justify-center">
    {indices.map((cardIndex, i) => (
      <Col key={`card-${cardIndex}-${i}`} className="px-0" xs={xs ?? 4} md={md ?? 2} xl={xl ?? 1}>
        <div className={highlight != null && highlight === cardIndex ? 'rounded-md ring-4 ring-green-500' : undefined}>
          {isKnown(cardIndex) ? <FoilCardImage card={cards[cardIndex]} autocard /> : <CardBack />}
        </div>
      </Col>
    ))}
  </Row>
);

export default HousmanCardRow;
