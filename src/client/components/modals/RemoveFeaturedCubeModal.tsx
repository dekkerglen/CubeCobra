import React from 'react';

import Button from '../base/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';

interface RemoveFeaturedCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const RemoveFeaturedCubeModal: React.FC<RemoveFeaturedCubeModalProps> = ({ isOpen, setOpen }) => {
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Removing featured cube
        </Text>
      </ModalHeader>
      <ModalBody>
        <p>You are about to remove your cube from the featured cubes queue. Do you wish to proceed?</p>
        <CSRFForm method="POST" action="/user/unqueuefeatured" ref={formRef} formData={{}}>
          <Button type="submit" color="danger" block onClick={() => formRef.current?.submit()}>
            Yes, remove my cube.
          </Button>
        </CSRFForm>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" block onClick={() => setOpen(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default RemoveFeaturedCubeModal;
