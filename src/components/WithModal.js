import React, { useCallback, useState } from 'react';

const withModal = (Tag, ModalTag) => ({ children, className, modalProps, ...props }) => {
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

  return (
    <>
      <Tag {...props} className={className ? `${className} clickable` : 'clickable'} onClick={toggle}>
        {children}
      </Tag>
      <ModalTag isOpen={isOpen} toggle={toggle} {...modalProps} />
    </>
  );
};

export default withModal;
