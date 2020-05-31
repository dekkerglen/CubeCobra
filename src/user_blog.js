import React from 'react';
import ReactDOM from 'react-dom';

import UserBlogPage from 'pages/UserBlogPage';

const element = <UserBlogPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
