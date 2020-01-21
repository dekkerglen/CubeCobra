import React from 'react';
import ReactDOM from 'react-dom';

import CubeBlogPage from 'pages/CubeBlogPage';

const wrapper = document.getElementById('react-root');
const element = <CubeBlogPage {...reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
