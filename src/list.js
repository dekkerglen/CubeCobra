import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Container, Row, Col } from 'reactstrap';

const VisualSpoiler = ({ cards }) => (
  <Container>
    <Row>
      <Col>
        {
          cards.map(({ index, details }) =>
            <a
              key={index}
              href="#"
              className="autocard"
              card={details.image_normal}
              card_flip={details.image_flip}
              card_tags={details.tags}
            >
              <img
                cardIndex={index}
                className="activateContextModal"
                src={details.image_normal}
                alt={details.name}
                width={150}
                height={210}
              />
            </a>
          )
        }
      </Col>
    </Row>
  </Container>
);

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cards = cube.map((card, index) => Object.assign(card, { index }));

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<VisualSpoiler cards={cards} />, wrapper) : false;
