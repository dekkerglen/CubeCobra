import React, { Component } from 'react';
import ReactDOM from 'react-dom';


import BlogPost from './components/BlogPost';

class SinglePost extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { post, userid, loggedIn, position } = this.props;
    return (
      <BlogPost key={post._id} post={post} canEdit={false} userid={userid} loggedIn={loggedIn} focused={position} />
    );
  }
}

const post = JSON.parse(document.getElementById('blogData').value);
const loggedIn = document.getElementById('userid') != null;
const hasPosition = document.getElementById('positionData') != null;
const userid = loggedIn ? document.getElementById('userid').value : '';
const position = hasPosition ? JSON.parse(document.getElementById('positionData').value) : [];
const wrapper = document.getElementById('react-root');
const element = <SinglePost post={post} loggedIn={loggedIn} userid={userid} position={position} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
