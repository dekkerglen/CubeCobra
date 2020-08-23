import React from 'react';
import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';
import LostPassword from 'pages/LostPassword';

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary className="mt-3">
    <LostPassword {...window.reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
