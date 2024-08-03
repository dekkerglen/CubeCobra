import React, { ReactElement } from 'react';

import ReactDOM from 'react-dom';

import ErrorBoundary from 'components/ErrorBoundary';
import AdsContext from 'contexts/AdsContext';
import { AutocardContextProvider } from 'contexts/AutocardContext';
import DomainContext, { DomainContextValue } from 'contexts/DomainContext';
import UserContext, { UserContextValue } from 'contexts/UserContext';

declare global {
  interface Window {
    reactProps: any;
  }
}

export interface ReactProps {
  nitroPayEnabled: boolean;
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
        // FIXME: update API below.
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
