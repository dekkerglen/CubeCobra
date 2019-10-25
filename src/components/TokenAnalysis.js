import React, { Component } from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';

import Affiliate from '../util/Affiliate';

class TokenAnalysis extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    autocard_init('autocard');
  }

  render() {
    var tokens = this.props.tokens;
    console.log(tokens);
    return (
      <Row>
        {tokens.map(token =>
        <Col key={token} xs={6} sm={6} md={4} lg={3}>
          <Card className="mb-2">
            <a href={Affiliate.getTCGLink({details:token[0]})}><img src={token[0].image_normal} className='card-img-top'></img></a>
            <CardBody>
              <p className="card-text">
                  {token[1].map( card =>
                    <a className="autocard" href={Affiliate.getTCGLink({details:card})}
                      key={card.name}
                      card={card.image_normal}
                      card_flip={card.image_flip}>
                      {card.name}
                      <br></br>
                    </a>    
                  )}
              </p>
            </CardBody>
          </Card>
        </Col>
        )}
      </Row>
    );
  }
}

export default TokenAnalysis;