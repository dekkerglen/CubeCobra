import React from 'react';

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Collapse } from 'reactstrap';

class BlogContextMenu extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);      
    this.state = {
      dropdownOpen: false,
      collapseOpen: false
    };
  }  
  
  toggle(event) {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen
    });
    updateBlog();
  }
  
  clickEdit(post) {    
    fetch("/cube/blogsrc/" + post._id)
      .then(response => response.json())
      .then(function(json) {
        if (json.src) {
          $('#editor').html(json.src);
        } else {
          $('#editor').html(json.body);
        }

        $('#postBlogTitleInput').val(json.title);
        $('#postBlogHiddenId').val(post._id);
        $('#blogEditTitle').text('Edit Blog Post');
        $('#editBlogModal').modal('show');
        autocard_init('autocard');
      });
  }
  
  clickDelete(post) {
    $("delete-blog" ).prop( "data-id", post._id );
    $('#deleteModal').modal('show');
  }

  render() {
    return (
      <Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
        <DropdownToggle tag="a" className="nav-link clickable">
          {this.props.value}
        </DropdownToggle>
        <DropdownMenu right>
          <DropdownItem>Edit</DropdownItem>
          <DropdownItem>Delete</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

export default BlogContextMenu