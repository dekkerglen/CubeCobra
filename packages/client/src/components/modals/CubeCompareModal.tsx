import React, { useContext, useState } from 'react';

import CubeContext from '../../contexts/CubeContext';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';

interface CubeCompareModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const CubeCompareModal: React.FC<CubeCompareModalProps> = ({ isOpen, setOpen }) => {
  const { cube } = useContext(CubeContext);
  const [compareID, setCompareID] = useState('');

  const handleCompare = () => {
    // Extract the Cube ID from the input, accounting for possible URL formats.
    const [ input ] = compareID.split('?')[0].trim().match(/[^/]+(?=\/$|$)/) || [];
    if (input) {
      window.location.href = `/cube/compare/${cube.id}/to/${input}`;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && compareID.trim()) {
      handleCompare();
    }
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Compare Cubes</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text>Enter the ID of the cube you want to compare with {cube.name}.</Text>
          <Input
            label="Comparison Cube ID"
            type="text"
            placeholder="Enter Cube ID"
            value={compareID}
            onChange={(e) => setCompareID(e.target.value)}
            onKeyDown={handleKeyDown}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
          />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <Button block color="primary" onClick={handleCompare} disabled={!compareID.trim()}>
            Compare
          </Button>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CubeCompareModal;
