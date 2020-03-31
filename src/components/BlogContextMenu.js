import React from 'react';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, } from 'reactstrap';

import BlogDeleteModal from './BlogDeleteModal';

import { csrfFetch } from '../util/CSRF';

class BlogContextMenu extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.openDeleteModal = this.openDeleteModal.bind(this);
    this.state = {
      dropdownOpen: false,
      deleteModalOpen: false,
    };
  }

  toggle() {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen,
    });
    updateBlog();
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
      <Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
        <DropdownToggle tag="a" className="nav-link clickable">
          {this.props.value}
        </DropdownToggle>
        <DropdownMenu right>
          <DropdownItem onClick={() => this.clickEdit(this.props.post)}>Edit</DropdownItem>
          <DropdownItem onClick={this.openDeleteModal}>
            Delete
            <BlogDeleteModal postID={this.props.post._id} isOpen={this.state.deleteModalOpen}>
            </BlogDeleteModal>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }

  componentDidUpdate() {
    if (this.state.deleteModalOpen) {
      this.setState({
        deleteModalOpen: false,
      });
    }
  }
}

export default BlogContextMenu;
