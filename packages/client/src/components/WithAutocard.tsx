import React, { ElementType, forwardRef, ReactNode, useContext, useEffect, useState } from 'react';

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
      const [isMobile, setIsMobile] = useState(false);

      useEffect(() => {
        const checkMobile = () => {
          setIsMobile(window.innerWidth < 768); // md breakpoint
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
      }, []);

      return (
        <Tag
          ref={ref}
          onMouseEnter={() => {
            if (!isMobile) {
              showCard(image ? { details: { image_normal: image } } : card, inModal, showCustomImages, tagColors);
            }
          }}
          onMouseLeave={() => {
            if (!isMobile) {
              hideCard();
            }
          }}
          {...(props as any)}
        />
      );
    },
  );
  Result.displayName = `withAutocard(${typeof Tag === 'function' ? Tag.displayName : Tag.toString()})`;
  return Result;
};

export default withAutocard;
