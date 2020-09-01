import React from 'react';
import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';

const RenderToRoot = (Element) => {
  const wrapper = document.getElementById('react-root');
  const element = (
    <ErrorBoundary className="mt-3">
      <Element {...window.reactProps} />
    </ErrorBoundary>
  );
  if (wrapper) {
    if (wrapper.children.length === 0) {
      ReactDOM.render(element, wrapper);
    } else {
      ReactDOM.hydrate(element, wrapper);
    }
  }

  return Element;
};

export default RenderToRoot;
