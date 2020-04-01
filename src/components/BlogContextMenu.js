import React from 'react';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

import BlogDeleteModal from './BlogDeleteModal';

import { csrfFetch } from '../utils/CSRF';

class BlogContextMenu extends React.Component {
  constructor(props) {
    super(props);
    this.deleteModal = React.createRef();
    this.toggle = this.toggle.bind(this);
    this.toggleDeleteModal = this.toggleDeleteModal.bind(this);
    this.openDeleteModal = this.openDeleteModal.bind(this);
    this.state = {
      dropdownOpen: false,
      deleteModalOpen: false,
    };
  }

  componentDidUpdate() {
    this.state;
  }

  toggle() {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen,
    });
    updateBlog();
  }

  toggleDeleteModal() {
    this.setState({
      deleteModalOpen: !this.state.deleteModalOpen,
    });
  }

  openDeleteModal() {
    this.setState({
      deleteModalOpen: true,
    });
  }

  clickEdit(post) {
    csrfFetch(`/cube/blogsrc/${post._id}`, {
      method: 'GET',
      headers: {},
    })
      .then((response) => response.json())
      .then(function(json) {
        $('#editor').html(json.src || json.body || '');

        $('#postBlogTitleInput').val(json.title);
        $('#postBlogHiddenId').val(post._id);
        $('#blogEditTitle').text('Edit Blog Post');
        $('#editBlogModal').modal('show');
        autocard_init('autocard');
      });
  }

  render() {
    return (
      <>
        <Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
          <DropdownToggle tag="a" className="nav-link clickable">
            {this.props.value}
          </DropdownToggle>
          <DropdownMenu right>
            <DropdownItem onClick={() => this.clickEdit(this.props.post)}>Edit</DropdownItem>
            <DropdownItem onClick={this.openDeleteModal}>Delete</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <BlogDeleteModal
          toggle={this.toggleDeleteModal}
          isOpen={this.state.deleteModalOpen}
          postID={this.props.post._id}
          ref={this.deleteModal}
        ></BlogDeleteModal>
      </>
    );
  }
}

export default BlogContextMenu;
