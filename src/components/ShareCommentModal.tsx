import React, { useContext } from 'react';
import { PasteIcon } from '@primer/octicons-react';
import { Modal, ModalHeader, ModalBody } from 'components/base/Modal';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import Comment from 'datatypes/Comment';
import DomainContext from 'contexts/DomainContext';
import { Flexbox } from './base/Layout';

interface ShareCommentModalProps {
  comment: Comment;
  isOpen: boolean;
  setOpen: (val: boolean) => void;
}

const ShareCommentModal: React.FC<ShareCommentModalProps> = ({ comment, isOpen, setOpen }) => {
  const domain = useContext(DomainContext);
  1;
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Share this Comment</ModalHeader>
      <ModalBody>
        <Flexbox direction="row" gap="2">
          <Input className="monospaced" value={`https://${domain}/comment/${comment.id}`} readOnly />
          <Button
            className="btn-sm input-group-button"
            onClick={() => navigator.clipboard.writeText(`https://${domain}/comment/${comment.id}`)}
            aria-label="Copy short ID"
          >
            <PasteIcon size={16} />
          </Button>
        </Flexbox>
      </ModalBody>
    </Modal>
  );
};

export default ShareCommentModal;
