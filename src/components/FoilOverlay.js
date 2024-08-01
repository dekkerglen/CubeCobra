import React from 'react';

const FoilOverlay =
  (Tag) =>
  ({ wrapperTag, ...props }) => {
    let finish = 'Non-foil';
    if (Object.hasOwnProperty.call(props, 'finish')) {
      finish = props.finish;
    } else if (Object.hasOwnProperty.call(props, 'card') && Object.hasOwnProperty.call(props.card, 'finish')) {
      finish = props.card.finish;
    }

    const WrapperTag = wrapperTag ?? 'div';
    const result = (
      <WrapperTag className="position-relative">
        {finish === 'Foil' && (
          <img src="/content/foilOverlay.png" className="foilOverlay card-border" width="100%" alt="Foil overlay" />
        )}
        <Tag {...props} />
      </WrapperTag>
    );
    result.displayName = Tag.displayName ? `FoilOverlay(${Tag.displayName})` : 'FoilOverlay';
  };

export default FoilOverlay;
