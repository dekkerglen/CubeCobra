import React, { useContext, useState, useCallback } from 'react';

import { Button, Collapse, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, Nav, Navbar, NavItem, NavLink } from 'reactstrap';

import BlogPost from 'components/BlogPost';
import CSRFForm from 'components/CSRFForm';
import CubeContext from 'components/CubeContext';
import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import TextEntry from 'components/TextEntry';
import CubeLayout from 'layouts/CubeLayout';

const EditBlogModal = ({ isOpen, toggle, html, setHtml, post }) => {
  const { cubeID } = useContext(CubeContext);
  const handleChangeHtml = useCallback((event) => setHtml(event.target.value), []);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="#blogEditTitle">
      <CSRFForm method="POST" action={`/cube/blog/post/${cubeID}`}>
        <ModalHeader toggle={toggle}>
          <h5 id="blogEditTitle">Edit Blog Post</h5>
        </ModalHeader>
        <ModalBody>
          <Label>Title:</Label>
          <Input maxlength="200" name="title" type="text" defaultValue={post ? post.title : ''} />
          <Label>Body:</Label>
          <Input type="hidden" name="id" value={post ? post._id : -1} />
          <TextEntry name="html" value={html} onChange={handleChangeHtml} />
        </ModalBody>
        <ModalFooter>
          <Button color="success" type="submit">Save</Button>
          <Button color="secondary" onClick={toggle}>Close</Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

const DeleteBlogModal = () => {
  <div
    class="modal fade"
    id="deleteModal"
    tabindex="-1"
    role="dialog"
    aria-labelledby="deleteModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Confirm Delete</h5>
          <button class="close" type="button" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="modal-body">
          <P>Are you sure you wish to delete this post? This action cannot be undone.</P>
        </div>
        <div class="modal-footer">
          <input class="btn btn-danger delete-blog" type="submit" value="Delete" data-id="" id="delete" />
          <button class="btn btn-secondary" type="button" data-dismiss="modal">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>;
};

const CubeBlogPage = ({ cube, cubeID, canEdit, pages, posts, userid, loggedIn }) => {
  const [editPostIndex, setEditPostIndex] = useState(-1);
  const [editOpen, setEditOpen] = useState(false);
  const [editHtml, setEditHtml] = useState('');
  const toggleEdit = useCallback(() => setEditOpen(open => !open), []);

  const [deletePostIndex, setDeletePostIndex] = useState(-1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const toggleDelete = useCallback(() => setDeleteOpen(open => !open), []);

  const handleEdit = useCallback((id) => {
    const postIndex = posts.findIndex((post) => post._id === id);
    setEditPostIndex(postIndex);
    setEditOpen(true);
    if (postIndex > -1) {
      setEditHtml(posts[postIndex].html);
    }
  }, [posts]);
  const handleDelete = useCallback((id) => {
    const postIndex = posts.findIndex((post) => post._id === id);
    if (postIndex > -1) {
      setDeletePostIndex(postIndex);
    }
  }, [posts]);
  return (
    <CubeLayout cube={cube} cubeID={cubeID} canEdit={canEdit} activeLink="blog">
      <Navbar expand light className="usercontrols mb-3">
        <Collapse navbar>
          <Nav navbar>
            <NavItem>
              <NavLink href="#">Create new blog post</NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Navbar>
      <DynamicFlash />
      {pages && pages.length > 1 && <Paginate pages={pages} />}
      {posts.map((post) => (
        <BlogPost key={post._id} post={post} canEdit={canEdit} userid={userid} loggedIn={loggedIn} onDelete={handleDelete} onEdit={handleEdit} />
      ))}
      {pages && pages.length > 1 && <Paginate pages={pages} />}
      <EditBlogModal isOpen={editOpen} toggle={toggleEdit} post={posts[editPostIndex]} html={editHtml} setHtml={setEditHtml} />
      <DeleteBlogModal isOpen={deleteOpen} toggle={toggleDelete} post={posts[deletePostIndex]} />
    </CubeLayout>
  );
};

export default CubeBlogPage;
