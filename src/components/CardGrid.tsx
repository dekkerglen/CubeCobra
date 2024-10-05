import React from 'react';

import CardDetails from 'datatypes/CardDetails';
import CardImage, { CardImageProps } from './CardImage';
import Card from 'datatypes/Card';
import { Col, Row, NumCols } from 'components/base/Layout';

export interface CardGridProps {
  cardList?: Card[];
  detailsList: CardDetails[];
  cardProps?: CardImageProps;
  xs?: NumCols;
  sm?: NumCols;
  md?: NumCols;
  lg?: NumCols;
  xl?: NumCols;
  xxl?: NumCols;
}

function CardGrid({ cardList, detailsList, cardProps, xs, sm, md, lg, xl, xxl }: CardGridProps) {
  return (
    <Row xs={xs} sm={sm} md={md} lg={lg} xl={xl} xxl={xxl}>
      {cardList &&
        cardList.map((card, cardIndex) => (
          <Col key={cardIndex} xs={1}>
            <CardImage card={card} autocard {...cardProps} />
          </Col>
        ))}
      {detailsList &&
        detailsList.map((details, cardIndex) => (
          <Col key={cardIndex} xs={1}>
            <a href={`/tool/card/${details.oracle_id}`}>
              <CardImage details={details} autocard {...cardProps} />
            </a>
          </Col>
        ))}
    </Row>
  );
}

export default CardGrid;
