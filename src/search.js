import React from 'react';
import ReactDOM from 'react-dom';

import SearchPage from 'pages/SearchPage';

const wrapper = document.getElementById('react-root');
const element = <SearchPage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
