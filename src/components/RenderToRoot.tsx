import React, { ReactElement } from 'react';
import ReactDOM from 'react-dom';

import UserContext, { UserContextValue } from 'contexts/UserContext';
import AdsContext, { AdsContextValue } from 'contexts/AdsContext';
import DomainContext, { DomainContextValue } from 'contexts/DomainContext';

import ErrorBoundary, { ErrorBoundaryProps } from 'components/ErrorBoundary';
import { AutocardContextProvider } from 'contexts/AutocardContext';

interface ReactProps {
  nitroPayEnabled: AdsContextValue;
  domain: DomainContextValue;
  user: UserContextValue;
}

const RenderToRoot = (Element: React.ComponentType<ReactProps>): React.ComponentType<ReactProps> => {
  const reactProps: ReactProps = typeof window !== 'undefined' ? window.reactProps : {};
  const element: ReactElement = (
    <ErrorBoundary className="mt-3">
      <AutocardContextProvider>
        <AdsContext.Provider value={reactProps.nitroPayEnabled}>
          <DomainContext.Provider value={reactProps.domain}>
            <UserContext.Provider value={reactProps.user}>
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
