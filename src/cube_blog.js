import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import BlogPost from './components/BlogPost';
import Paginate from './components/Paginate';

class CubeBlog extends Component {
  constructor(props) {
    super(props);
  }

  select(nav) {
    this.setState({ });
  }

  render() {
    const {pages, posts, canEdit} = this.props
    return (
      <>
        {(pages && pages.length > 1) &&
          <Paginate pages={pages} />
        }
        {posts.map(post =>
          <BlogPost post={post} canEdit={canEdit}/>
        )}
        {(pages && pages.length > 1) &&
          <Paginate pages={pages} />
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
