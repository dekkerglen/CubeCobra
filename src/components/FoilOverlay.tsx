import React, { ComponentProps, ElementType } from 'react';

import Card from 'datatypes/Card';

export interface FoilOverlayProps {
  wrapperTag?: ElementType;
  finish?: string;
  card: Card;
}

const FoilOverlay = <T extends ElementType>(Tag: T) => {
  const FoilOverlayComponent: React.FC<ComponentProps<T> & FoilOverlayProps> = ({
    wrapperTag: WrapperTag = 'div',
    ...props
  }) => {
    let finish = 'Non-foil';
    if (props.finish) {
      finish = props.finish;
    } else if (props.card && props.card.finish) {
      finish = props.card.finish;
    }

    const Result = (
      <WrapperTag className="position-relative">
        {finish === 'Foil' && (
          <img src="/content/foilOverlay.png" className="foilOverlay card-border" width="100%" alt="Foil overlay" />
        )}
        <Tag {...(props as any)} />
      </WrapperTag>
    );
    return Result;
  };

  FoilOverlayComponent.displayName = `FoilOverlay(${typeof Tag === 'function' ? Tag.displayName : Tag.toString()})`;

  return FoilOverlayComponent;
};

export default FoilOverlay;
