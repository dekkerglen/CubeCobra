import React from 'react';
import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';
import PasswordReset from 'pages/PasswordReset';

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary className="mt-3">
    <PasswordReset {...window.reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  if (wrapper.children.length === 0) {
    ReactDOM.render(element, wrapper);
  } else {
    ReactDOM.hydrate(element, wrapper);
  }
}
