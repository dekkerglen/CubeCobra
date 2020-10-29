import React from 'react';
import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';

const RenderToRoot = (Element) => {
  const reactProps = typeof window !== 'undefined' ? window.reactProps : {};
  const element = (
    <ErrorBoundary className="mt-3">
      <Element {...reactProps} />
    </ErrorBoundary>
  );
  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById('react-root');
    if (wrapper && wrapper.children.length === 0) {
      ReactDOM.render(element, wrapper);
    } else {
      ReactDOM.hydrate(element, wrapper);
    }
  }

  return Element;
};

export default RenderToRoot;
