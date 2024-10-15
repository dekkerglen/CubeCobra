import React from 'react';

import CardImage, { CardImageProps } from './CardImage';
import Card from 'datatypes/Card';
import { Col, Row, NumCols } from 'components/base/Layout';

export interface CardGridProps {
  cards: Card[];
  cardProps?: CardImageProps;
  xs?: NumCols;
  sm?: NumCols;
  md?: NumCols;
  lg?: NumCols;
  xl?: NumCols;
  xxl?: NumCols;
  hrefFn?: (card: Card) => string;
  onClick?: (card: Card) => void;
}

function CardGrid({ cards, cardProps, xs, sm, md, lg, xl, xxl, hrefFn, onClick }: CardGridProps) {
  if (hrefFn) {
    return (
      <Row xs={xs} sm={sm} md={md} lg={lg} xl={xl} xxl={xxl}>
        {cards.map((card, cardIndex) => (
          <Col key={cardIndex} xs={1}>
            <a href={hrefFn(card)} className="hover:cursor-pointer">
              <CardImage card={card} autocard {...cardProps} />
            </a>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row xs={xs} sm={sm} md={md} lg={lg} xl={xl} xxl={xxl}>
      {cards.map((card, cardIndex) => (
        <Col key={cardIndex} xs={1}>
          <CardImage
            card={card}
            autocard
            onClick={() => onClick && onClick(card)}
            className={onClick ? 'hover:cursor-pointer' : ''}
            {...cardProps}
          />
        </Col>
      ))}
    </Row>
  );
}

export default CardGrid;
