import React from 'react';

const FoilOverlay = (Tag) => (props) =>
  <div>
    <img
      src="/content/foilOverlay.png"
      className={'foilOverlay card-border' + (props.card && props.card.finish === 'Foil' ? '' : ' d-none')}
      width="100%"
    />
    <Tag {...props} />
  </div>;

export default FoilOverlay;
