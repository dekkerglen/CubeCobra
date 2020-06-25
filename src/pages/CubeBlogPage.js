import React, { useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Collapse,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  Navbar,
  NavItem,
  NavLink,
} from 'reactstrap';

import BlogPost from 'components/BlogPost';
import CSRFForm from 'components/CSRFForm';
import CubeContext from 'components/CubeContext';
import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import TextEntry from 'components/TextEntry';
import CubeLayout from 'layouts/CubeLayout';

const EditBlogModal = ({ isOpen, toggle, html, setHtml, post }) => {
  const { cubeID } = useContext(CubeContext);
  const handleChangeHtml = useCallback((event) => setHtml(event.target.value), [setHtml]);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="#blogEditTitle" size="lg">
      <CSRFForm method="POST" action={`/cube/blog/post/${cubeID}`}>
        <ModalHeader toggle={toggle} id="blogEditTitle">
          Edit Blog Post
        </ModalHeader>
        <ModalBody>
          <Label>Title:</Label>
          <Input maxLength="200" name="title" type="text" defaultValue={post ? post.title : ''} />
          <Label>Body:</Label>
          {post && <Input type="hidden" name="id" value={post._id} />}
          <TextEntry name="html" value={html} onChange={handleChangeHtml} />
        </ModalBody>
        <ModalFooter>
          <Button color="success" type="submit">
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

EditBlogModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  html: PropTypes.string.isRequired,
  setHtml: PropTypes.func.isRequired,
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }),
};

EditBlogModal.defaultProps = {
  post: null,
};

const CubeBlogPage = ({ cube, cubeID, canEdit, pages, activePage, posts, userid, loggedIn }) => {
  const [editPostIndex, setEditPostIndex] = useState(-1);
  const [editOpen, setEditOpen] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const toggleEdit = useCallback(() => setEditOpen((open) => !open), []);

  const handleEdit = useCallback(
    (id) => {
      const postIndex = posts.findIndex((post) => post._id === id);
      setEditPostIndex(postIndex);
      setEditOpen(true);
      if (postIndex > -1) {
        setEditHtml(posts[postIndex].html);
      }
    },
    [posts],
  );

  const handleNew = useCallback(() => handleEdit(-1), [handleEdit]);

  return (
    <CubeLayout cube={cube} cubeID={cubeID} canEdit={canEdit} activeLink="blog">
      <Navbar expand light className="usercontrols mb-3">
        <Collapse navbar>
          <Nav navbar>
            <NavItem>
              <NavLink href="#" onClick={handleNew}>
                Create new blog post
              </NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Navbar>
      <DynamicFlash />
      {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/blog/${cubeID}/${i}`} />}
      {posts.length > 0 ? (
        posts.map((post) => (
          <BlogPost
            key={post._id}
            post={post}
            canEdit={canEdit}
            userid={userid}
            loggedIn={loggedIn}
            onEdit={handleEdit}
          />
        ))
      ) : (
        <h5>No blog posts for this cube.</h5>
      )}
      {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/blog/${cubeID}/${i}`} />}
      <EditBlogModal
        isOpen={editOpen}
        toggle={toggleEdit}
        post={posts[editPostIndex]}
        html={editHtml}
        setHtml={setEditHtml}
      />
    </CubeLayout>
  );
};

CubeBlogPage.propTypes = {
  cube: PropTypes.shape({}).isRequired,
  cubeID: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      html: PropTypes.string.isRequired,
    }),
  ).isRequired,
  userid: PropTypes.string.isRequired,
  loggedIn: PropTypes.bool.isRequired,
};

CubeBlogPage.defaultProps = {
  canEdit: false,
};

export default CubeBlogPage;
