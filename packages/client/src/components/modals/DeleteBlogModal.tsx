import React from 'react';

import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import BlogPost from '@utils/datatypes/BlogPost';

interface DeleteCubeModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  post: BlogPost;
}

const DeleteBlogModal: React.FC<DeleteCubeModalProps> = ({ isOpen, setOpen, post }) => {
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Delete Blog</ModalHeader>
      <ModalBody>
        <Text>Are you sure you want to delete this blog post? This action cannot be undone.</Text>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <Button block type="link" color="danger" href={`/cube/blog/remove/${post.id}`}>
            Delete
          </Button>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteBlogModal;
