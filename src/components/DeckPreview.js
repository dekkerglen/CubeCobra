import React from 'react';

import AgeText from './AgeText';

class DeckPreview extends React.Component {
  constructor(props) 
  {
      super(props);
  }

  render() {
    var deck = this.props.deck;
    return (
        <a className="no-underline-hover" href={'/cube/deck/'+deck._id}><div className="border-top pb-2 pt-3 px-2 deck-preview">
          <h6 className="card-subtitle mb-2 text-muted">
              {deck.owner ?
                <a href={"/user/view/" + deck.owner}>{deck.username}</a>
              :
                <a>Anonymous</a>
              }
              {" drafted "} 
              <a href={"/cube/overview/" + deck.cube}>{deck.cubename}</a>
              {" - "} 
              <AgeText date={deck.date}/>
          </h6>      
        </div></a>
    );
  }
}

export default DeckPreview