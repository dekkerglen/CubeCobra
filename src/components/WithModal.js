import React, { useCallback, useState } from 'react';

import { Modal, ModalHeader } from 'reactstrap';

const withModal = (Tag, ModalTag) => ({ labelledBy, title, text, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(
    (event) => {
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen],
  );

  return (
    <Tag {...props} onClick={toggle}>
      {children}
      <ModalTag isOpen={isOpen} toggle={toggle} />
    </Tag>
  );
};

export default withModal;
