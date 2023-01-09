import React from 'react';
import ReactDOM from 'react-dom';

import UserContext from 'contexts/UserContext';
import AdsContext from 'contexts/AdsContext';
import DomainContext from 'contexts/DomainContext';

import ErrorBoundary from 'components/ErrorBoundary';
import { AutocardContextProvider } from 'contexts/AutocardContext';

const RenderToRoot = (Element) => {
  const reactProps = typeof window !== 'undefined' ? window.reactProps : {};
  const element = (
    <ErrorBoundary className="mt-3">
      <AutocardContextProvider>
        <AdsContext.Provider value={reactProps ? reactProps.nitroPayEnabled : null}>
          <DomainContext.Provider value={reactProps ? reactProps.domain : null}>
            <UserContext.Provider value={reactProps ? reactProps.user : null}>
              <Element {...reactProps} />
            </UserContext.Provider>
          </DomainContext.Provider>
        </AdsContext.Provider>
      </AutocardContextProvider>
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
