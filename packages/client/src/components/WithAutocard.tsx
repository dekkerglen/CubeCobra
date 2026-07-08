import React, { ElementType, forwardRef, ReactNode, useContext } from 'react';

import Card from '@utils/datatypes/Card';

import AutocardContext from 'contexts/AutocardContext';
import DisplayContext from 'contexts/DisplayContext';

import TagColorContext from '../contexts/TagColorContext';

export interface WithAutocardProps {
  card?: Card;
  image?: string;
  inModal?: boolean;
  children?: ReactNode;
}

const withAutocard = <T extends ElementType>(Tag: T) => {
  const Result = forwardRef<T, WithAutocardProps & React.ComponentProps<T>>(
    ({ card, image, inModal, ...props }, ref) => {
      const { showCustomImages } = useContext(DisplayContext);
      const { showCard, hideCard } = useContext(AutocardContext);
      const tagColors = useContext(TagColorContext);

      const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

      const handleMouseEnter = () => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768 && !isTouchDevice) {
          showCard(image ? { details: { image_normal: image } } : card, inModal, showCustomImages, tagColors);
        }
      };

      const handleMouseLeave = () => {
        if (typeof window !== 'undefined' && window.innerWidth >= 768 && !isTouchDevice) {
          hideCard();
        }
      };

      const handleClick = (event: React.MouseEvent<any> | React.PointerEvent<any>) => {
        if (isTouchDevice) {
          hideCard();
        }
        const originalOnClick = (props as any).onClick;
        if (typeof originalOnClick === 'function') {
          originalOnClick(event);
        }
      };

      return (
        <Tag
          ref={ref}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          {...(props as any)}
        />
      );
    },
  );
  Result.displayName = `withAutocard(${typeof Tag === 'function' ? Tag.displayName : Tag.toString()})`;
  return Result;
};

export default withAutocard;
