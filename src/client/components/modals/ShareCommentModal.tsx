import React, { useContext } from 'react';

import { PasteIcon } from '@primer/octicons-react';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';
import Comment from 'datatypes/Comment';

import BaseUrlContext from '../../contexts/BaseUrlContext';
import { Flexbox } from '../base/Layout';

interface ShareCommentModalProps {
  comment: Comment;
  isOpen: boolean;
  setOpen: (val: boolean) => void;
}

const ShareCommentModal: React.FC<ShareCommentModalProps> = ({ comment, isOpen, setOpen }) => {
  const baseUrl = useContext(BaseUrlContext);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Share this Comment</ModalHeader>
      <ModalBody>
        <Flexbox direction="row" gap="2">
          <Input className="monospaced" value={`${baseUrl}/comment/${comment.id}`} readOnly />
          <Button
            className="btn-sm input-group-button"
            onClick={() => navigator.clipboard.writeText(`${baseUrl}/comment/${comment.id}`)}
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
