/* eslint-disable react/prop-types */
import React, { useCallback, useState } from 'react';

const withModal =
  (Tag, ModalTag) =>
  ({ children, className, modalProps, altClick, ...props }) => {
    const [isOpen, setIsOpen] = useState(false);
    const toggle = useCallback(
      (event) => {
        if (event) {
          event.preventDefault();
        }
        setIsOpen(!isOpen);
      },
      [isOpen],
    );

    const handleClick = useCallback(
      (event) => {
        // only prevent default if ctrl wasn't pressed
        if (altClick && event.ctrlKey) {
          return altClick();
        }

        event.preventDefault();
        return toggle();
      },
      [altClick, toggle],
    );

    return (
      <>
        <Tag {...props} className={className ? `${className} clickable` : 'clickable'} onClick={handleClick}>
          {children}
        </Tag>
        <ModalTag isOpen={isOpen} toggle={toggle} {...modalProps} />
      </>
    );
  };

export default withModal;
