import React from 'react';
import CSRFForm from '../CSRFForm';
import Text from '../base/Text';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Input from '../base/Input';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';

interface AddCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const AddCubeModal: React.FC<AddCubeModalProps> = ({ isOpen, setOpen }) => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [cubeId, setCubeId] = React.useState('');

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <CSRFForm
        method="POST"
        action="/admin/featuredcubes/queue"
        ref={formRef}
        formData={{
          cubeId,
        }}
      >
        <ModalHeader setOpen={setOpen}>
          <Text semibold lg>
            Add Cube to Queue
          </Text>
        </ModalHeader>
        <ModalBody>
          <Input label="Cube ID" type="text" name="cubeId" value={cubeId} onChange={(e) => setCubeId(e.target.value)} />
        </ModalBody>
        <ModalFooter>
          <Flexbox justify="between" className="w-full" gap="2">
            <Button color="primary" block onClick={() => formRef.current?.submit()}>
              Submit
            </Button>
            <Button color="secondary" block onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default AddCubeModal;
