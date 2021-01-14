import PropTypes from 'prop-types';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

import useToggle from 'hooks/UseToggle';

const CommentContextMenu = ({ edit, remove, children }) => {
  const [open, toggle] = useToggle(false);

  return (
    <Dropdown isOpen={open} toggle={toggle}>
      <DropdownToggle tag="a" className="nav-link clickable py-0">
        {children}
      </DropdownToggle>
      <DropdownMenu right>
        <DropdownItem onClick={edit}>Edit</DropdownItem>
        <DropdownItem onClick={remove}>Delete</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

CommentContextMenu.propTypes = {
  edit: PropTypes.func.isRequired,
  remove: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default CommentContextMenu;
