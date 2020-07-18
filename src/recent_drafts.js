import React from 'react';
import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';
import RecentDrafts from 'pages/RecentDrafts';

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary className="mt-3">
    <RecentDrafts {...window.reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
