import React from 'react';
import { Row, Col } from 'reactstrap';


const TokenAnalysis = ({ tokens }) => (
  <div>
    <Row>
      {tokens.map(token =>
      <Col key={token} xs={6} sm={6} md={4} lg={4}>
        <div className="card">
          <img src={token[0].image_small} className='card-img-top'></img>
          <div className="card-body">
            <p className="card-text">
                {token[1].map( card =>
                  <a href="#" key={card.name}>
                    {card.name}
                    <br></br>
                  </a>    
                )}
            </p>
          </div>
        </div>
      </Col>
      )}
    </Row>
  </div>
);

export default TokenAnalysis;
