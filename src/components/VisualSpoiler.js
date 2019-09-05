import React from 'react';

import { Container, Row, Col } from 'reactstrap';

import Autocard from './Autocard';

const VisualSpoiler = ({ cards, ...props }) => (
  <Container {...props}>
    <Row>
      <Col>
        {
          cards.map(({ index, details }) => <Autocard key={index} {...details} />)
        }
      </Col>
    </Row>
  </Container>
);

export default VisualSpoiler;
