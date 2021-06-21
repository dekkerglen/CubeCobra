import React from 'react';
import ReactDOM from 'react-dom';

import UserContext from 'contexts/UserContext';
import AdsContext from 'contexts/AdsContext';

import ErrorBoundary from 'components/ErrorBoundary';

const RenderToRoot = (Element) => {
  const reactProps = typeof window !== 'undefined' ? window.reactProps : {};
  const element = (
    <ErrorBoundary className="mt-3">
      <AdsContext.Provider value={reactProps.nitroPayEnabled}>
        <UserContext.Provider value={reactProps.user}>
          <Element {...reactProps} />
        </UserContext.Provider>
      </AdsContext.Provider>
    </ErrorBoundary>
  );
  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById('react-root');
    if (wrapper) {
      if (wrapper.children.length === 0) {
        ReactDOM.render(element, wrapper);
      } else {
        ReactDOM.hydrate(element, wrapper);
      }
    }
  }

  return Element;
};

export default RenderToRoot;
