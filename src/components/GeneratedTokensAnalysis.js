import React from 'react';



const GeneratedTokensAnalysis = ( GeneratedTokensCounts) => (
  <div>
    <h4>GeneratedTokensAnalysis</h4>
    {console.log(GeneratedTokensCounts)}
    <div>
    {GeneratedTokensCounts.GeneratedTokensCounts.map(token =>
      <div style={{width: 150, margin:10}}>
        <img src={token[0].image_small}></img>
        {token[1].map( sourceCard =>
        <div>
          {sourceCard.name}
        </div>
        )}
      </div>

    )}
    </div>  
  </div>
);

export default GeneratedTokensAnalysis;
