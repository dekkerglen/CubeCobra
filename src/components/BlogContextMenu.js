import React from 'react';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Collapse, Modal,
  ModalBody, ModalFooter, ModalHeader, Card, CardHeader, Row, Col, FormGroup,
  Label, Input, CardBody, Button, } from 'reactstrap';

class BlogDeleteModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: Boolean(props.isOpen),
    }
    
    this.close = this.close.bind(this);
    this.confirm = this.confirm.bind(this);
    this.keyPress = this.keyPress.bind(this);

    if (this.state.isOpen) {
      document.addEventListener("keyup", this.keyPress);
    }
  }

  close() {
    document.removeEventListener("keyup", this.keyPress);
    this.setState({
      isOpen: false,
    });
  }

  keyPress(event) {
    if (event.keyCode === 13) {
      this.confirm();
    }
  }

  confirm() {
    csrfFetch(`/cube/blog/remove/${this.props.postID}`, {
      method: 'DELETE',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      } else {
        window.location.href = '';
      }
    });
  }

  render() {
    const {isOpen} = this.state;
    return (
      <>
        <Modal isOpen={isOpen} toggle={this.close}>
          <ModalHeader toggle={this.close}>Confirm Delete</ModalHeader>
          <ModalBody>
            <p>Are you sure you wish to delete this post? This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" onClick={this.confirm}>
              Delete
            </Button>{' '}
            <Button color="secondary" onClick={this.close}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </>
    )
  }
}

class BlogContextMenu extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.openDeleteModal = this.openDeleteModal.bind(this);
    this.state = {
      dropdownOpen: false,
      collapseOpen: false,
      deleteModalIsOpen: false,
    };
  }

  toggle(event) {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen,
    });
    updateBlog();
  }

  openDeleteModal(){
    this.setState({
      deleteModalIsOpen: true,
    });
  }

  clickEdit(post) {
    csrfFetch('/cube/blogsrc/' + post._id, {
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
            <BlogDeleteModal postID={this.props.post._id} isOpen={this.state.deleteModalIsOpen}>
            </BlogDeleteModal>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

export default BlogContextMenu;
