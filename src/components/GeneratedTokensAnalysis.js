import React from 'react';
import { Col, Row, Table } from 'reactstrap';


const GeneratedTokensAnalysis = ( GeneratedTokensCounts) => (
  <div>
    <h4>GeneratedTokensAnalysis</h4>
    {GeneratedTokensCounts.forEach(function(GeneratedTokensCounts,i) {
      <li>{GeneratedTokensCounts[i]}</li>
    })}
       
      
       
      
    
  </div>
);

export default GeneratedTokensAnalysis;
