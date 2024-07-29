import React from 'react';
import { Row, Col, ColProps } from 'reactstrap';
import Card from 'datatypes/Card';

interface CardImageProps<T> {
  Tag: React.ComponentType<T>;
  card: Card;
  cardProps: T;
  linkDetails: boolean;
}

function cardImage<T>({ Tag, card, cardProps, linkDetails }: CardImageProps<T>): React.ReactNode {
  const cardTag = <Tag card={card} {...cardProps} modalProps={{ card }} />;
  if (linkDetails && card.details?.scryfall_id) {
    return <a href={`/tool/card/${card.details?.scryfall_id}`}>{cardTag}</a>;
  }
  return cardTag;
}

interface CardGridProps<T> {
  cardList: Card[];
  Tag: React.ComponentType<T>;
  colProps?: ColProps;
  cardProps: T;
  linkDetails: boolean;
}

function CardGrid<T>({ cardList, Tag, colProps, cardProps, linkDetails = false, ...props }: CardGridProps<T>) {
  return (
    <Row className="justify-content-center g-0" {...props}>
      {cardList.map((card, cardIndex) => (
        <Col key={cardIndex} {...colProps}>
          {cardImage<T>({ Tag, card, cardProps, linkDetails })}
        </Col>
      ))}
    </Row>
  );
}

export default CardGrid;
