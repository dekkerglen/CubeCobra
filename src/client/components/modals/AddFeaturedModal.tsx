import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import Cube from 'datatypes/Cube';
import Select from 'components/base/Select';
import { Flexbox } from 'components/base/Layout';

interface AddFeaturedModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubes: Cube[];
}

const AddFeaturedModal: React.FC<AddFeaturedModalProps> = ({ isOpen, setOpen, cubes }) => {
  const [selectedCube, setSelectedCube] = React.useState<string>('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = React.useMemo(() => ({ cube: selectedCube }), [selectedCube]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen}>
      <CSRFForm method="POST" action="/user/queuefeatured" ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>
          <Text semibold lg>
            Select Cube
          </Text>
        </ModalHeader>
        <ModalBody>
          <Select
            id="featuredCube"
            options={cubes.map((cube) => ({ value: cube.id, label: cube.name }))}
            label="Cube"
            value={selectedCube?.toString()}
            setValue={(value) => setSelectedCube(value)}
          />
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" className="w-full">
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

export default AddFeaturedModal;
