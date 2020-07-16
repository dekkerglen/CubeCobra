import React from 'react';
import ReactDOM from 'react-dom';

import GridDraftPage from 'pages/GridDraftPage';

const wrapper = document.getElementById('react-root');
const element = <GridDraftPage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
