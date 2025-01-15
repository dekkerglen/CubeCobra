import React, { useMemo, useState } from 'react';

import BlogPost from '../../datatypes/BlogPost';
import Button from './base/Button';
import Input from './base/Input';
import { Flexbox } from './base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './base/Modal';
import CSRFForm from './CSRFForm';
import TextEntry from './TextEntry';

interface EditBlogModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  post?: BlogPost;
  cubeID: string;
}

const EditBlogModal: React.FC<EditBlogModalProps> = ({ isOpen, setOpen, post, cubeID }) => {
  const [markdown, setMarkdown] = useState<string>(post ? post.body : '');
  const formRef = React.createRef<HTMLFormElement>();
  const [title, setTitle] = useState<string>(post?.title ?? '');
  const formData = useMemo(
    () => ({
      title,
      markdown,
    }),
    [title, markdown],
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <CSRFForm method="POST" action={`/cube/blog/post/${cubeID}`} ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>Edit Blog Post</ModalHeader>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Input
              label="Title"
              required
              minLength={5}
              maxLength={200}
              name="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {post && <input type="hidden" name="id" value={post.id} />}
            <TextEntry name="markdown" value={markdown} setValue={setMarkdown} maxLength={10000} />
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" gap="2" className="w-full">
            <Button type="submit" block color="primary">
              Save
            </Button>
            <Button block color="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default EditBlogModal;
