import React from 'react';
import { Row, Col } from 'reactstrap';


const GeneratedTokensAnalysis = ({ tokens }) => (
  <div>
    <h4>GeneratedTokensAnalysis</h4>    
    <Row>
{tokens.map(token =>
  <Col xs={12} sm={6} md={4} lg={2}>
    <div class="card">
        <img src={token[0].image_small} className='card-img-top'></img>
        <div class="card-body">
            <p class="card-text">
                {token[1].map( sourceCard =>
                <div>
                    <a>
                      {sourceCard.name}
                    </a><br></br>    
                    </div>
                )}
            </p>
        </div>
    </div>
  </Col>
)}
</div>
  </div>
);

export default GeneratedTokensAnalysis;
