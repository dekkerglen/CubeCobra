/* eslint-disable react/prop-types */
import React, { useContext, forwardRef } from 'react';

import DisplayContext from 'contexts/DisplayContext';
import AutocardContext from 'contexts/AutocardContext';

const withAutocard = (Tag) =>
  forwardRef(({ card, image, inModal, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext);
    const { showCard, hideCard } = useContext(AutocardContext);

    if (image) {
      return (
        <Tag
          ref={ref}
          onMouseEnter={() => showCard({ details: { image_normal: image } }, inModal, showCustomImages)}
          onMouseLeave={() => hideCard()}
          {...props}
        />
      );
    }

    return (
      <Tag
        ref={ref}
        onMouseEnter={() => showCard(card, inModal, showCustomImages)}
        onMouseLeave={() => hideCard()}
        {...props}
      />
    );
  });

export default withAutocard;
