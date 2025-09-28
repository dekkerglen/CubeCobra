import React, { useCallback, useContext, useState } from 'react';

import { findUserLinks } from 'markdown/parser';

import { CSRFContext } from '../../contexts/CSRFContext';
import Alert, { UncontrolledAlertProps } from '../base/Alert';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import TextEntry from '../TextEntry';

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
  const { csrfFetch } = useContext(CSRFContext);
  const [markdown, setMarkdown] = useState<string>(post ? post.markdown : '');
  const [title, setTitle] = useState<string>(post ? post.title : '');
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);

  const saveChanges = useCallback(async () => {
    //Clear alerts when saving so easy to identify a new one appearing
    setAlerts([]);

    const response = await csrfFetch(`/cube/blog/post/${cubeID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        markdown: markdown,
        mentions: findUserLinks(markdown).join(';'),
        id: '',
      }),
    });

    const body = await response.json();
    if (response.ok) {
      setAlerts([{ color: 'success', message: body.ok }]);
      //Reload page to ensure state is updated
      window.location.replace(body.redirect);
    } else if (response.status === 403) {
      setAlerts([{ color: 'danger', message: 'You must be logged in to create a blog post.' }]);
    } else {
      setAlerts([{ color: 'danger', message: body.error }]);
    }
  }, [csrfFetch, cubeID, title, markdown]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <Flexbox direction="col" gap="2" className="m-2">
        <ModalHeader setOpen={setOpen}>Create Blog Post</ModalHeader>
        <Text lg semibold>
          Title:
        </Text>
        <Input
          required
          minLength={5}
          maxLength={100}
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Text lg semibold>
          Body:
        </Text>
        <TextEntry name="markdown" value={markdown} setValue={setMarkdown} maxLength={10000} />
        {alerts.map(({ color, message }) => (
          <Alert key={message} color={color} className="mt-2">
            {message}
          </Alert>
        ))}
      </Flexbox>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <Button color="primary" block onClick={saveChanges}>
            Save
          </Button>
          <Button color="secondary" block onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default CreateBlogModal;
