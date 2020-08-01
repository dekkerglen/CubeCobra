import React from 'react';
import PropTypes from 'prop-types';

import { encodeName } from 'utils/Card';

import { Row, Col } from 'reactstrap';

function cardImage(Tag, card, cardProps, linkDetails) {
  const cardTag = <Tag card={card} {...cardProps} />;
  if (linkDetails) return <a href={`/tool/card/${card.details._id}`}>{cardTag}</a>;
  return cardTag;
}

const CardGrid = ({ cardList, Tag, colProps, cardProps, linkDetails, ...props }) => {
  return (
    <Row noGutters className="justify-content-center" {...props}>
      {cardList.map((card, cardIndex) => (
        <Col key={/* eslint-disable-line react/no-array-index-key */ cardIndex} {...colProps}>
          {cardImage(Tag, card, cardProps, linkDetails)}
        </Col>
      ))}
    </Row>
  );
};

CardGrid.propTypes = {
  cardList: PropTypes.arrayOf(
    PropTypes.shape({
      imgUrl: PropTypes.string,
      details: PropTypes.shape({
        name: PropTypes.string.isRequired,
        image_normal: PropTypes.string.isRequired,
      }),
    }),
  ).isRequired,
  Tag: PropTypes.func.isRequired,
  colProps: PropTypes.shape({}),
  cardProps: PropTypes.shape({}),
  linkDetails: PropTypes.bool,
};

CardGrid.defaultProps = {
  colProps: null,
  cardProps: null,
  linkDetails: false,
};

export default CardGrid;
