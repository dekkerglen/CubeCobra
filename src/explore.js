import React from 'react';
import ReactDOM from 'react-dom';

import ExplorePage from 'pages/ExplorePage';

const wrapper = document.getElementById('react-root');
const element = <ExplorePage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
