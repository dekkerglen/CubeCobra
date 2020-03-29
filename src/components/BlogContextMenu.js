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
    updateBlog();
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

  clickDelete(post) {
    $('#deleteModal').modal('show');

    var clickDeleteBlog = function(e) {
      if (event.keyCode === 13) {
        $('.delete-blog').click();
      }
    };

    $(window).on('keyup', clickDeleteBlog)

    $('#deleteModal').on('hidden.bs.modal', function() {
      $(window).off('keyup', clickDeleteBlog)
    });

    $('.delete-blog')
      .off()
      .on('click', function(e) {
        csrfFetch('/cube/blog/remove/' + post._id, {
          method: 'DELETE',
          headers: {},
        }).then((response) => {
          if (!response.ok) {
            console.log(response);
          } else {
            window.location.href = '';
          }
        });
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
          <DropdownItem
            onClick={() => {
              this.clickDelete(this.props.post);
            }}
          >
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }
}

export default BlogContextMenu;
