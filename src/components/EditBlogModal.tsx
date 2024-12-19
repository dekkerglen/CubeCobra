import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import CSRFForm from 'components/CSRFForm';
import TextEntry from 'components/TextEntry';
import BlogPost from 'datatypes/BlogPost';
import React, { useMemo, useState } from 'react';
import { Flexbox } from './base/Layout';

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
            {post && <Input type="hidden" name="id" value={post.id} />}
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
