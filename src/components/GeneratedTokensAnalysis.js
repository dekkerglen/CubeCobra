import React from 'react';
import { Grid } from '@material-ui/core';


const GeneratedTokensAnalysis = ( GeneratedTokensCounts) => (
  <div>
    <h4>GeneratedTokensAnalysis</h4>
    {console.log(GeneratedTokensCounts)}
    <Grid >
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
    </Grid>  
  </div>
);

export default GeneratedTokensAnalysis;
