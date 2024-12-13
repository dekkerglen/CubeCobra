import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { PasteIcon } from '@primer/octicons-react';
import Text from 'components/base/Text';

interface CubeIdModalProps {
  setOpen: (open: boolean) => void;
  isOpen: boolean;
  shortId: string;
  fullID: string;
  alert: (type: string, message: string) => void;
}

const CubeIdModal: React.FC<CubeIdModalProps> = ({ setOpen, isOpen, shortId, fullID, alert }) => {
  const onCopyClick = async (id: string, label: string) => {
    await navigator.clipboard.writeText(id);
    alert('success', `${label} copied to clipboard`);
    setOpen(false);
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>Cube ID</ModalHeader>
      <ModalBody>
        <Text semibold sm>
          short ID
        </Text>
        <div className="flex items-center mb-2">
          <Input className="bg-white monospaced" value={shortId} readOnly />
          <Button
            className="btn-sm input-group-button"
            onClick={() => onCopyClick(shortId, 'short ID')}
            aria-label="Copy short ID"
          >
            <PasteIcon size={16} />
          </Button>
        </div>
        <Text sm>A custom, memorable ID that owners are allowed to modify.</Text>
        <Text semibold sm>
          Full ID
        </Text>
        <div className="flex items-center mb-2">
          <Input className="bg-white monospaced" value={fullID} readOnly />
          <Button
            className="btn-sm input-group-button"
            onClick={() => onCopyClick(fullID, 'Full ID')}
            aria-label="Copy Full ID"
          >
            <PasteIcon size={16} />
          </Button>
        </div>
        <Text sm>The canonical unique ID for this cube, guaranteed not to change.</Text>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={() => setOpen(false)}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CubeIdModal;
