import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import BlogPost from './components/BlogPost';
import Paginate from './components/Paginate';

class CubeBlog extends Component {
  constructor(props) {
    super(props);

    this.state = {
        posts: this.props.posts,
        pages: this.props.pages,
        canEdit: this.props.canEdit
      };
  }

  componentDidMount() {
    updateBlog();
  }

  select(nav) {
    this.setState({ });
  }

  render() {
    console.log(this.props.posts);
      return (
        <>
          {!(this.props.pages && this.props.pages.length > 1) ? '' :
            <Paginate pages={this.props.pages} />
          }
          {this.props.posts.map(post =>
            <BlogPost post={post} canEdit={this.props.canEdit}/>
          )}
          {!(this.props.pages && this.props.pages.length > 1) ? '' :
            <Paginate pages={this.props.pages} />
          }
      </>
    );
  }
}

const posts = JSON.parse(document.getElementById('blogData').value);  
const pages = JSON.parse(document.getElementById('blogPages').value); 
const canEdit = document.getElementById('canEdit').value === 'true';
const wrapper = document.getElementById('react-root');
const element = <CubeBlog posts={posts} pages={pages} canEdit={canEdit} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
