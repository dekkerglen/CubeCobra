import CSRFForm from 'components/CSRFForm';
import TextEntry from 'components/TextEntry';
import { findUserLinks } from 'markdown/parser';
import React, { useMemo, useState } from 'react';
import Button from './base/Button';
import Input from './base/Input';
import { Flexbox } from './base/Layout';
import { Modal, ModalFooter, ModalHeader } from './base/Modal';
import Text from './base/Text';

interface BlogPost {
  id: string;
  title: string;
  markdown: string;
}

interface CreateBlogModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  post?: BlogPost | null;
  cubeID: string;
}

const CreateBlogModal: React.FC<CreateBlogModalProps> = ({ isOpen, setOpen, post = null, cubeID }) => {
  const [markdown, setMarkdown] = useState<string>(post ? post.markdown : '');
  const [title, setTitle] = useState<string>(post ? post.title : '');
  const formRef = React.createRef<HTMLFormElement>();

  const formData = useMemo(() => {
    return {
      title: title,
      markdown: markdown,
      mentions: findUserLinks(markdown).join(';'),
      id: post ? post.id : '',
    };
  }, [post, markdown]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <CSRFForm method="POST" action={`/cube/blog/post/${cubeID}`} formData={formData} ref={formRef}>
        <Flexbox direction="col" gap="2" className="m-2">
          <ModalHeader setOpen={setOpen}>Create Blog Post</ModalHeader>
          <Text lg semibold>
            Title:
          </Text>
          <Input
            required
            minLength={5}
            maxLength={200}
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Text lg semibold>
            Body:
          </Text>
          <TextEntry name="markdown" value={markdown} setValue={setMarkdown} maxLength={10000} />
        </Flexbox>
        <ModalFooter>
          <Flexbox direction="row" gap="2" className="w-full">
            <Button color="primary" block onClick={() => formRef.current?.submit()}>
              Save
            </Button>
            <Button color="danger" block onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default CreateBlogModal;
