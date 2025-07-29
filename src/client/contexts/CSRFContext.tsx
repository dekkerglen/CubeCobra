import React, { createContext, useCallback, useEffect, useState } from 'react';

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
  children: JSX.Element;
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

export const CSRFContextProvider: React.FC<CSRFContextProviderProps> = ({ children }) => {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      const response = await fetch(`/user/csrf`, {
        credentials: 'same-origin',
        mode: 'same-origin',
      });

      if (!response.ok) {
        return null;
      }
      const json = await response.json();
      if (json.success !== 'true') {
        return null;
      }
      setCsrfToken(json.token);
    };
    run();
  }, []);

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
