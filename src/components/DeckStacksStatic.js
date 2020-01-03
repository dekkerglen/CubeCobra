import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardImage, CardTitle, Col, Row } from 'reactstrap';

import FoilCardImage from './FoilCardImage';

const DeckStacksStatic = ({ title, cards, noAutocard, ...props }) => (
  <Card {...props}>
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">{title}</h4>
      </CardTitle>
    </CardHeader>
    <CardBody className="pt-0">
      {cards.map((row, index) => (
        <Row key={index} className="row-low-padding">
          {row.map((column, index2) => (
            <Col key={index2} className="mt-3 card-stack col-md-1-5 col-low-padding" xs={4} sm={3}>
              <div className="w-100 text-center mb-1">
                <b>{column.length}</b>
              </div>
              <div className="stack">
                {column.map((card, index3) => (
                  <div className="stacked" key={index3}>
                    <FoilCardImage card={card} tags={[]} autocard={!noAutocard} />
                  </div>
                ))}
              </div>
            </Col>
          ))}
        </Row>
      ))}
    </CardBody>
  </Card>
);

DeckStacksStatic.propTypes = {
  title: PropTypes.string.isRequired,
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
  noAutocard: PropTypes.bool,
};

export default DeckStacksStatic;
