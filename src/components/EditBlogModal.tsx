import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import CSRFForm from 'components/CSRFForm';
import TextEntry from 'components/TextEntry';
import { findUserLinks } from 'markdown/parser';
import BlogPost from 'datatypes/BlogPost';

interface EditBlogModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  post?: BlogPost;
  cubeID: string;
}

const EditBlogModal: React.FC<EditBlogModalProps> = ({ isOpen, setOpen, post, cubeID }) => {
  const [mentions, setMentions] = useState('');
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

  const handleMentions = () => {
    setMentions(findUserLinks(markdown).join(';'));
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <CSRFForm
        method="POST"
        action={`/cube/blog/post/${cubeID}`}
        onSubmit={handleMentions}
        ref={formRef}
        formData={formData}
      >
        <ModalHeader setOpen={setOpen}>Edit Blog Post</ModalHeader>
        <ModalBody>
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
          <Input name="mentions" type="hidden" value={mentions} />
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={() => setOpen(false)}>
            Save
          </Button>
          <Button color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default EditBlogModal;
