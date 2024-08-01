import React, { useContext, forwardRef, ElementType, ReactNode } from 'react';

import DisplayContext from 'contexts/DisplayContext';
import AutocardContext from 'contexts/AutocardContext';
import Card from 'datatypes/Card';

export interface WithAutocardProps {
  card?: Card;
  image?: string;
  inModal?: boolean;
  children?: ReactNode;
}

const withAutocard = <T extends ElementType>(Tag: T) =>
  forwardRef<T, WithAutocardProps & React.ComponentProps<T>>(({ card, image, inModal, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext);
    const { showCard, hideCard } = useContext(AutocardContext);

    return (
      <Tag
        ref={ref}
        onMouseEnter={() => showCard(image ? { details: { image_normal: image } } : card, inModal, showCustomImages)}
        onMouseLeave={() => hideCard()}
        {...(props as any)}
      />
    );
  });

export default withAutocard;
