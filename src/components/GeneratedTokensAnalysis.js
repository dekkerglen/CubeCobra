import React from 'react';

//i guess some sort of map that generates an image and a list for each token is in order here.
const TokenAnalysis = ({ GeneratedTokens, ...props }) => (

        <Row {...props}>
          <Col>
            <h4 className="d-lg-block d-none">Generated Tokens</h4>
            
          </Col>
        </Row>
      );

export default GeneratedTokensAnalysis;
