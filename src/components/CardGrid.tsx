import React from 'react';
import { Col, ColProps, Row } from 'reactstrap';

import CardDetails from 'datatypes/CardDetails';

export interface CardImageProps<T extends { card: { imgUrl?: string; details?: CardDetails } }> {
  Tag: React.ComponentType<T>;
  cardProps: T;
  linkDetails: boolean;
}

function cardImage<T extends { card: { imgUrl?: string; details?: CardDetails } }>({
  Tag,
  cardProps,
  linkDetails,
}: CardImageProps<T>): React.ReactNode {
  const { card } = cardProps;
  const cardTag = <Tag {...cardProps} modalProps={{ card }} />;
  if (linkDetails && card.details?.scryfall_id) {
    return <a href={`/tool/card/${card.details?.scryfall_id}`}>{cardTag}</a>;
  }
  return cardTag;
}

export interface CardGridProps<T extends { card: { imgUrl?: string; details?: CardDetails } }> {
  cardList: { imgUrl?: string; details?: CardDetails }[];
  Tag: React.ComponentType<T>;
  colProps?: ColProps;
  cardProps: Omit<T, 'card'>;
  linkDetails: boolean;
}

function CardGrid<T extends { card: { imgUrl?: string; details?: CardDetails } }>({
  cardList,
  Tag,
  colProps,
  cardProps,
  linkDetails = false,
  ...props
}: CardGridProps<T>) {
  return (
    <Row className="justify-content-center g-0" {...props}>
      {cardList.map((card, cardIndex) => (
        <Col key={cardIndex} {...colProps}>
          {
            // @ts-expect-error (this will always work out in practice)
            cardImage<T>({ Tag, cardProps: { ...cardProps, card }, linkDetails })
          }
        </Col>
      ))}
    </Row>
  );
}

export default CardGrid;
