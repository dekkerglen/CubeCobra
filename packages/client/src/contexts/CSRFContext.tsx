import React, { createContext, useCallback } from 'react';

type ExtendedRequestInit = RequestInit & { timeout?: number };

interface CSRFContext {
  csrfToken: string;
  csrfFetch: (input: RequestInfo, init?: ExtendedRequestInit) => Promise<Response>;
  callApi: (route: RequestInfo, body: any) => Promise<Response>;
}

export const CSRFContext = createContext<CSRFContext>({
  csrfToken: '',
  csrfFetch: async () => {
    throw new Error('csrfFetch function not initialized');
  },
  callApi: async () => {
    throw new Error('callApi function not initialized');
  },
});

interface CSRFContextProviderProps {
  children: React.ReactNode;
  csrfToken: string;
}

async function fetchWithTimeout(resource: RequestInfo, options: ExtendedRequestInit = {}): Promise<Response> {
  const { timeout = 10000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

export const CSRFContextProvider: React.FC<CSRFContextProviderProps> = ({ children, csrfToken }) => {
  const csrfFetch = useCallback(
    async (resource: RequestInfo, init?: ExtendedRequestInit) => {
      if (init) {
        init.credentials = init.credentials || 'same-origin';
      }

      if (csrfToken !== null && init) {
        init.headers = {
          ...init.headers,
          'CSRF-Token': csrfToken,
        };
      }
      return fetchWithTimeout(resource, init);
    },
    [csrfToken],
  );

  const callApi = useCallback(
    async (route: RequestInfo, body: any) => {
      return csrfFetch(route, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    [csrfFetch],
  );

  return <CSRFContext.Provider value={{ csrfToken, csrfFetch, callApi }}>{children}</CSRFContext.Provider>;
};
