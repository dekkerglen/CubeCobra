import React, { ComponentProps, ElementType } from 'react';

import Card from '../datatypes/Card';

export interface FoilOverlayProps {
  wrapperTag?: ElementType;
  finish?: string;
  card: Card;
  innerRef?: React.Ref<any>;
}

const FoilOverlay = <T extends ElementType>(Tag: T) => {
  const FoilOverlayComponent: React.FC<ComponentProps<T> & FoilOverlayProps> = ({
    wrapperTag: WrapperTag = 'div',
    innerRef,
    ...props
  }) => {
    let finish = 'Non-foil';
    if (props.finish) {
      finish = props.finish;
    } else if (props.card && props.card.finish) {
      finish = props.card.finish;
    }

    const Result = (
      <WrapperTag className="relative">
        <Tag ref={innerRef} {...(props as any)} />
        {finish === 'Foil' && (
          <img
            src="/content/foilOverlay.png"
            className="absolute inset-0 w-full h-full foilOverlay card-border"
            width="100%"
            alt="Foil overlay"
          />
        )}
      </WrapperTag>
    );
    return Result;
  };

  FoilOverlayComponent.displayName = `FoilOverlay(${typeof Tag === 'function' ? Tag.displayName : Tag.toString()})`;

  return FoilOverlayComponent;
};

export default FoilOverlay;
