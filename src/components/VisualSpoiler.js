import React from 'react';

import { Container, Row, Col } from 'reactstrap';

import AutocardImage from './AutocardImage';

const VisualSpoiler = ({ cards, ...props }) => (
  <Row noGutters className="mt-3 justify-content-center" {...props}>
    {
      cards.map(({ index, details }) =>
        <Col key={index} className="w-auto flex-grow-0">
          <div key={index} className="visualSpoilerCardContainer">
            <AutocardImage key={index} index={index} {...details} />
          </div>
        </Col>
      )
    }
  </Row>
);

export default VisualSpoiler;
