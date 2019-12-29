import React from 'react';

const FoilOverlay = (Tag) => (props) => {
  let finish = 'Non-foil';
  if (props.hasOwnProperty('finish')) {
    finish = props.finish;
  } else if (props.hasOwnProperty('card') && props.card.hasOwnProperty('finish')) {
    finish = props.card.finish;
  }
  return (
    <div className="position-relative">
      {finish !== 'Foil' ? '' : <img src="/content/foilOverlay.png" className="foilOverlay card-border" width="100%" />}
      <Tag {...props} />
    </div>
  );
};

export default FoilOverlay;
