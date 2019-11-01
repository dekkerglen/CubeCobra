import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import DynamicFlash from './components/DynamicFlash';

class CubeBlog extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
    );
  }
}

const posts = JSON.parse(document.getElementById('blogData').value);  
const pages = JSON.parse(document.getElementById('blogPages').value); 
const loggedIn = document.getElementById('userid') != null;
const userid = loggedIn ? document.getElementById('userid').value : '';
const canEdit = document.getElementById('canEdit').value === 'true';
const wrapper = document.getElementById('react-root');
const element = <CubeBlog posts={posts} pages={pages} canEdit={canEdit} loggedIn={loggedIn} userid={userid} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
