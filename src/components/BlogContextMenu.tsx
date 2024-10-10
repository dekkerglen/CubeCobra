import React, { useState } from 'react';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';

import BlogDeleteModal from 'components/BlogDeleteModal';
import BlogPost from 'datatypes/BlogPost';

export interface BlogContextMenuProps {
  post: BlogPost;
  value: string;
  onEdit: (id: string) => void;
}

const BlogContextMenu: React.FC<BlogContextMenuProps> = ({ post, value, onEdit }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const toggle = () => {
    setDropdownOpen((prevState) => !prevState);
  };

  const toggleDeleteModal = () => {
    setDeleteModalOpen((prevState) => !prevState);
  };

  const openDeleteModal = () => {
    setDeleteModalOpen(true);
  };

  return (
    <>
      <Dropdown isOpen={dropdownOpen} toggle={toggle}>
        <DropdownToggle tag="a" className="text-secondary clickable">
          {value}
        </DropdownToggle>
        <DropdownMenu end>
          <DropdownItem onClick={() => onEdit(post.id)}>Edit</DropdownItem>
          <DropdownItem onClick={openDeleteModal}>Delete</DropdownItem>
        </DropdownMenu>
      </Dropdown>
      <BlogDeleteModal toggle={toggleDeleteModal} isOpen={deleteModalOpen} postID={post.id} />
    </>
  );
};

export default BlogContextMenu;
