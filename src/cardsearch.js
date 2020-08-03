import React from 'react';
import ReactDOM from 'react-dom';

import CardSearchPage from 'pages/CardSearchPage';

const wrapper = document.getElementById('react-root');
const element = <CardSearchPage {...window.reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
