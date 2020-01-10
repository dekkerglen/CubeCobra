import React from 'react';
import ReactDOM from 'react-dom';

import DraftView from './components/DraftView';

const wrapper = document.getElementById('react-root');
const element = <DraftView {...reactProps} />;
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
