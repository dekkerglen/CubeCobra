import React from 'react';
import ReactDOM from 'react-dom';

import CubeListPage from 'pages/CubeListPage';

const wrapper = document.getElementById('react-root');
const element = <CubeListPage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
