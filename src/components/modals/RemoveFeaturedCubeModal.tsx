import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';

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
