import React, { useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import UserPropType from 'proptypes/UserPropType';

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
import CubeContext from 'contexts/CubeContext';
import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import TextEntry from 'components/TextEntry';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import { findUserlinks } from 'markdown/parser';

const EditBlogModal = ({ isOpen, toggle, markdown, setMarkdown, post }) => {
  const { cubeID } = useContext(CubeContext);
  const [mentions, setMentions] = useState([]);
  const handleChangeMarkdown = useCallback((event) => setMarkdown(event.target.value), [setMarkdown]);
  const handleMentions = (event) => {
    setMentions(findUserlinks(markdown));
    // event.preventDefault();
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="#blogEditTitle" size="lg">
      <CSRFForm method="POST" action={`/cube/blog/post/${cubeID}`} onSubmit={handleMentions}>
        <ModalHeader toggle={toggle} id="blogEditTitle">
          Edit Blog Post
        </ModalHeader>
        <ModalBody>
          <Label>Title:</Label>
          <Input maxLength="200" name="title" type="text" defaultValue={post ? post.title : ''} />
          <Label>Body:</Label>
          {post && <Input type="hidden" name="id" value={post._id} />}
          <TextEntry name="markdown" value={markdown} onChange={handleChangeMarkdown} maxLength={10000} />
          {mentions.map((name) => (
            <Input maxLength="100" name="mentions" type="hidden" value={name} />
          ))}
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
  markdown: PropTypes.string.isRequired,
  setMarkdown: PropTypes.func.isRequired,
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }),
};

EditBlogModal.defaultProps = {
  post: null,
};

const CubeBlogPage = ({ user, cube, pages, activePage, posts, loginCallback }) => {
  const [editPostIndex, setEditPostIndex] = useState(-1);
  const [editOpen, setEditOpen] = useState(false);
  const [editMarkdown, setEditMarkdown] = useState('');
  const toggleEdit = useCallback(() => setEditOpen((open) => !open), []);

  const handleEdit = useCallback(
    (id) => {
      const postIndex = posts.findIndex((post) => post._id === id);
      setEditPostIndex(postIndex);
      setEditOpen(true);
      if (postIndex > -1) {
        setEditMarkdown(posts[postIndex].markdown);
      }
    },
    [posts],
  );

  const handleNew = useCallback(() => handleEdit(-1), [handleEdit]);

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <CubeLayout cube={cube} cubeID={cube._id} canEdit={user && cube.owner === user.id} activeLink="blog">
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
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/blog/${cube._id}/${i}`} />}
        {posts.length > 0 ? (
          posts.map((post) => (
            <BlogPost
              key={post._id}
              post={post}
              canEdit={user && post.owner === user.id}
              userid={user ? user.id : null}
              loggedIn={user !== null}
              onEdit={handleEdit}
            />
          ))
        ) : (
          <h5>No blog posts for this cube.</h5>
        )}
        {pages > 1 && <Paginate count={pages} active={activePage} urlF={(i) => `/cube/blog/${cube._id}/${i}`} />}
        <EditBlogModal
          isOpen={editOpen}
          toggle={toggleEdit}
          post={posts[editPostIndex]}
          markdown={editMarkdown}
          setMarkdown={setEditMarkdown}
        />
      </CubeLayout>
    </MainLayout>
  );
};

CubeBlogPage.propTypes = {
  cube: CubePropType.isRequired,
  pages: PropTypes.number.isRequired,
  activePage: PropTypes.number.isRequired,
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      markdown: PropTypes.string,
    }),
  ).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubeBlogPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeBlogPage);
