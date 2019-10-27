import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import BlogPost from './components/BlogPost';
import Paginate from './components/Paginate';

class CubeBlog extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {pages, posts, canEdit, userid, loggedIn} = this.props
    return (
      <>
        {(pages && pages.length > 1) &&
          <Paginate pages={pages} />
        }
        {posts.map(post =>
          <BlogPost key={post._id} post={post} canEdit={canEdit} userid={userid} loggedIn={loggedIn} />
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
const loggedIn = document.getElementById('userid') != null;
var userid = '';
if(loggedIn)
{
  userid = document.getElementById('userid').value; 
}
const canEdit = document.getElementById('canEdit').value === 'true';
const wrapper = document.getElementById('react-root');
const element = <CubeBlog posts={posts} pages={pages} canEdit={canEdit} loggedIn={loggedIn} userid={userid} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
