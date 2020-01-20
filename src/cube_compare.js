import React from 'react';
import ReactDOM from 'react-dom';

import CubeComparePage from 'pages/CubeComparePage';

const wrapper = document.getElementById('react-root');
const element = (
  <CubeComparePage {...reactProps} />
);
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}