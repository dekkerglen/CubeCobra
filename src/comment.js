import React from 'react';
import ReactDOM from 'react-dom';

import CommentPage from 'pages/CommentPage';

const wrapper = document.getElementById('react-root');
const element = <CommentPage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
