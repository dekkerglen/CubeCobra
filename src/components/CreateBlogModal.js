import React, { useState } from 'react';
import { Button, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';

import PropTypes from 'prop-types';
import BlogPostPropType from 'proptypes/BlogPostPropType';

import CSRFForm from 'components/CSRFForm';
import TextEntry from 'components/TextEntry';
import { findUserLinks } from 'markdown/parser';

const CreateBlogModal = ({ isOpen, toggle, post, cubeID }) => {
  const [mentions, setMentions] = useState('');
  const [markdown, setMarkdown] = useState(post ? post.markdown : '');
  const handleMentions = () => {
    setMentions(findUserLinks(markdown).join(';'));
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="#blogEditTitle" size="lg">
      <CSRFForm method="POST" action={`/cube/blog/post/${cubeID}`} onSubmit={handleMentions}>
        <ModalHeader toggle={toggle} id="blogEditTitle">
          Create Blog Post
        </ModalHeader>
        <ModalBody>
          <Label>Title:</Label>
          <Input
            required
            minLength={5}
            maxLength={200}
            name="title"
            type="text"
            defaultValue={post ? post.title : ''}
          />
          <Label className="mt-3">Body:</Label>
          {post && <Input type="hidden" name="id" value={post.id} />}
          <TextEntry name="markdown" value={markdown} onChange={(e) => setMarkdown(e.target.value)} maxLength={10000} />
          <Input name="mentions" type="hidden" value={mentions} />
        </ModalBody>
        <ModalFooter>
          <Button color="accent" type="submit">
            Save
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

CreateBlogModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  post: BlogPostPropType,
  cubeID: PropTypes.string.isRequired,
};

CreateBlogModal.defaultProps = {
  post: null,
};

export default CreateBlogModal;
