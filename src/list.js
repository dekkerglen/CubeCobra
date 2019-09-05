import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Container, Row, Col } from 'reactstrap';

import Autocard from './components/Autocard';

const VisualSpoiler = ({ cards }) => (
  <Container>
    <Row>
      <Col>
        {
          cards.map(({ index, details }) => <Autocard key={index} {...details} />)
        }
      </Col>
    </Row>
  </Container>
);

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cards = cube.map((card, index) => Object.assign(card, { index }));

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<VisualSpoiler cards={cards} />, wrapper) : false;
