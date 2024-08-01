import React from 'react';

import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';
import AdsContext from 'contexts/AdsContext';
import { AutocardContextProvider } from 'contexts/AutocardContext';
import DomainContext from 'contexts/DomainContext';
import UserContext from 'contexts/UserContext';

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
        // FIXME: deal with the below
        // eslint-disable-next-line react/no-deprecated
        ReactDOM.render(element, wrapper);
      } else {
        // eslint-disable-next-line react/no-deprecated
        ReactDOM.hydrate(element, wrapper);
      }
    }
  }

  return Element;
};

export default RenderToRoot;
