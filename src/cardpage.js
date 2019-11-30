import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardHeader, Row, Col, CardBody, CardText } from 'reactstrap';

class CardPage extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {card, data} = this.props;
    return (
        <Card>
            <CardHeader>{card.name}</CardHeader>
            <CardBody><pre>{JSON.stringify(data, null, 2)}</pre> </CardBody>
      </Card>
    );
  }
}

const data = JSON.parse(document.getElementById('data').value);
const card = JSON.parse(document.getElementById('card').value);
const wrapper = document.getElementById('react-root');
const element = <CardPage data={data} card={card} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
