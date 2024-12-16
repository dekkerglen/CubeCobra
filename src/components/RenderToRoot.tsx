import React, { ComponentType, ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

import ErrorBoundary from 'components/ErrorBoundary';
import AdsContext from 'contexts/AdsContext';
import { AutocardContextProvider } from 'contexts/AutocardContext';
import DomainContext, { DomainContextValue } from 'contexts/DomainContext';
import UserContext, { UserContextValue } from 'contexts/UserContext';
import CaptchaContext from 'contexts/CaptchaContext';

declare global {
  interface Window {
    reactProps: any;
  }
}

export interface UniversalReactProps {
  nitroPayEnabled: boolean;
  domain: DomainContextValue;
  user: UserContextValue;
  theme: string;
  captchaSiteKey: string;
}

// Returns its input to enable our usual pattern of export default RenderToRoot(XPage).
const RenderToRoot = <P,>(Element: ComponentType<P>): ComponentType<P> => {
  const reactProps: P & UniversalReactProps = typeof window !== 'undefined' ? window.reactProps : {};
  const element: ReactElement = (
    <ErrorBoundary className="mt-3">
      <CaptchaContext.Provider value={reactProps.captchaSiteKey}>
        <AutocardContextProvider>
          <AdsContext.Provider value={reactProps.nitroPayEnabled}>
            <DomainContext.Provider value={reactProps.domain}>
              <UserContext.Provider value={reactProps.user}>
                <Element {...reactProps} />
              </UserContext.Provider>
            </DomainContext.Provider>
          </AdsContext.Provider>
        </AutocardContextProvider>
      </CaptchaContext.Provider>
    </ErrorBoundary>
  );

  if (typeof document !== 'undefined') {
    const wrapper = document.getElementById('react-root');
    if (wrapper) {
      const root = createRoot(wrapper); // createRoot(wrapper!) if you use TypeScript
      root.render(element);
    }
  }

  return Element;
};

export default RenderToRoot;
