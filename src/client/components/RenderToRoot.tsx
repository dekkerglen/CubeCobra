import React, { ComponentType, ReactElement } from 'react';

import { createRoot } from 'react-dom/client';

import AdsContext from '../contexts/AdsContext';
import { AutocardContextProvider } from '../contexts/AutocardContext';
import BaseUrlContext, { BaseUrlContextValue } from '../contexts/BaseUrlContext';
import CaptchaContext from '../contexts/CaptchaContext';
import { CSRFContextProvider } from '../contexts/CSRFContext';
import UserContext, { UserContextValue } from '../contexts/UserContext';
import ErrorBoundary from './ErrorBoundary';

declare global {
  interface Window {
    reactProps: any;
  }
}

export interface UniversalReactProps {
  nitroPayEnabled: boolean;
  baseUrl: BaseUrlContextValue;
  user: UserContextValue;
  theme: string;
  captchaSiteKey: string;
  csrfToken: string;
}

// Returns its input to enable our usual pattern of export default RenderToRoot(XPage).
const RenderToRoot = <P,>(Element: ComponentType<P>): ComponentType<P> => {
  const reactProps: P & UniversalReactProps = typeof window !== 'undefined' ? window.reactProps : {};
  const element: ReactElement = (
    <ErrorBoundary className="mt-3">
      <CSRFContextProvider csrfToken={reactProps.csrfToken}>
        <CaptchaContext.Provider value={reactProps.captchaSiteKey}>
          <AutocardContextProvider>
            <AdsContext.Provider value={reactProps.nitroPayEnabled}>
              <BaseUrlContext.Provider value={reactProps.baseUrl}>
                <UserContext.Provider value={reactProps.user || null}>
                  <Element {...reactProps} />
                </UserContext.Provider>
              </BaseUrlContext.Provider>
            </AdsContext.Provider>
          </AutocardContextProvider>
        </CaptchaContext.Provider>
      </CSRFContextProvider>
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
