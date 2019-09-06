import React from 'react';

import { Container, Row, Col } from 'reactstrap';

import Autocard from './Autocard';

const VisualSpoiler = ({ cards, ...props }) => (
  <Container {...props}>
    <Row>
      <Col>
        {
          cards.map(({ index, details }) =>
            <div className="visualSpoilerCardContainer">
              <Autocard key={index} {...details} />
            </div>
          )
        }
      </Col>
    </Row>
  </Container>
);

export default VisualSpoiler;
