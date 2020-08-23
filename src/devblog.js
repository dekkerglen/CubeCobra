import React from 'react';
import ReactDOM from 'react-dom';

import DevBlog from 'pages/DevBlog';

const element = <DevBlog {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
