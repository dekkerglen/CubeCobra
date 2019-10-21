import React from 'react';
import { Col, Row, Table } from 'reactstrap';


const GeneratedTokensAnalysis = ( GeneratedTokensCounts) => (
  <div>
    <h4>GeneratedTokensAnalysis</h4>
    {console.log(GeneratedTokensCounts)}
    {GeneratedTokensCounts.GeneratedTokensCounts.map(item =>
      <li>{item[0]}</li>
    )}
        
  </div>
);

export default GeneratedTokensAnalysis;
