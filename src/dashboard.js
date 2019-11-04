import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import BlogPost from './components/BlogPost';
import PagedList from './components/PagedList';

class Dashboard extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <PagedList pageSize={10} rows={this.props.posts.slice(0).reverse().map(post =>
        <BlogPost key={post._id} post={post} canEdit={false} userid={userid} loggedIn={true} />
    )}>
    </PagedList>   
    );
  }
}

const posts = JSON.parse(document.getElementById('blogData').value);  
const userid = document.getElementById('userid').value;
const wrapper = document.getElementById('react-root');
const element = <Dashboard posts={posts} userid={userid} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
