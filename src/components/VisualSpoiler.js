import React from 'react';

import { Container, Row, Col } from 'reactstrap';

import AutocardImage from './AutocardImage';

const VisualSpoiler = ({ cards, ...props }) => (
  <Container {...props}>
    <Row>
      <Col>
        {
          cards.map(({ index, details }) =>
            <div className="visualSpoilerCardContainer">
              <AutocardImage key={index} index={index} {...details} />
            </div>
          )
        }
      </Col>
    </Row>
  </Container>
);

export default VisualSpoiler;
