import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';

import ImageFallback from './components/ImageFallback';

class CardPage extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {card, data} = this.props;
    console.log(card);
    return (
        <Card>
            <CardHeader><h4>{card.name}</h4></CardHeader>
            <CardBody>
              <Row>
                <Col xs="12" sm="4">
                  <ImageFallback
                    className="w-100"
                    src={card.image_normal}
                    fallbackSrc="/content/default_card.png"
                    alt={card.name}
                  />
                  <div className="price-area">
                  </div>
                </Col>
              <Col xs="12" sm="8">
              </Col>
            </Row>
            </CardBody>
      </Card>
    );
  }
}

const data = JSON.parse(document.getElementById('data').value);
const card = JSON.parse(document.getElementById('card').value);
const wrapper = document.getElementById('react-root');
const element = <CardPage data={data} card={card} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
