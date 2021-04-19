import React from 'react';
import PropTypes from 'prop-types';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

import BlogDeleteModal from 'components/BlogDeleteModal';

class BlogContextMenu extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.toggleDeleteModal = this.toggleDeleteModal.bind(this);
    this.openDeleteModal = this.openDeleteModal.bind(this);
    this.state = {
      dropdownOpen: false,
      deleteModalOpen: false,
    };
  }

  toggle() {
    this.setState((prevState) => ({
      dropdownOpen: !prevState.dropdownOpen,
    }));
  }

  toggleDeleteModal() {
    this.setState((prevState) => ({
      deleteModalOpen: !prevState.deleteModalOpen,
    }));
  }

  openDeleteModal() {
    this.setState({
      deleteModalOpen: true,
    });
  }

  render() {
    const { dropdownOpen, deleteModalOpen } = this.state;
    const { post, value, onEdit } = this.props;
    return (
      <>
        <Dropdown isOpen={dropdownOpen} toggle={this.toggle}>
          <DropdownToggle tag="a" className="nav-link clickable">
            {value}
          </DropdownToggle>
          <DropdownMenu right>
            <DropdownItem onClick={() => onEdit(post._id)}>Edit</DropdownItem>
            <DropdownItem onClick={this.openDeleteModal}>Delete</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <BlogDeleteModal toggle={this.toggleDeleteModal} isOpen={deleteModalOpen} postID={post._id} />
      </>
    );
  }
}

BlogContextMenu.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  value: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
};

export default BlogContextMenu;
