import React from 'react';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Collapse } from 'reactstrap';

class BlogContextMenu extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.state = {
      dropdownOpen: false,
      collapseOpen: false,
    };
  }

  toggle(event) {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen,
    });
  }

  render() {
    return (
      <Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
        <DropdownToggle tag="a" className="nav-link clickable">
          {this.props.value}
        </DropdownToggle>
        <DropdownMenu right>
          <DropdownItem onClick={this.props.edit}>Edit</DropdownItem>
          <DropdownItem onClick={this.props.delete}>Delete</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

export default BlogContextMenu;
