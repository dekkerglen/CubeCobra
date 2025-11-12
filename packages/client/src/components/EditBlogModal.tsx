import React, { useCallback, useContext, useState } from 'react';

import BlogPost from '@utils/datatypes/BlogPost';

import { CSRFContext } from '../contexts/CSRFContext';
import Alert, { UncontrolledAlertProps } from './base/Alert';
import Button from './base/Button';
import Input from './base/Input';
import { Flexbox } from './base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './base/Modal';
import TextEntry from './TextEntry';

interface EditBlogModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  post?: BlogPost;
  cubeID: string;
}

const EditBlogModal: React.FC<EditBlogModalProps> = ({ isOpen, setOpen, post, cubeID }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [markdown, setMarkdown] = useState<string>(post?.body ?? '');
  const [title, setTitle] = useState<string>(post?.title ?? '');
  const [postId] = useState<string>(post?.id ?? '');
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
        id: postId,
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
  }, [csrfFetch, cubeID, postId, title, markdown]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>Edit Blog Post</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Input
            label="Title"
            required
            minLength={5}
            maxLength={100}
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {post && <input type="hidden" name="id" value={post.id} />}
          <TextEntry name="markdown" value={markdown} setValue={setMarkdown} maxLength={10000} />
          {alerts.map(({ color, message }) => (
            <Alert key={message} color={color} className="mt-2">
              {message}
            </Alert>
          ))}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <Button type="submit" block color="primary" onClick={saveChanges}>
            Save
          </Button>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default EditBlogModal;
