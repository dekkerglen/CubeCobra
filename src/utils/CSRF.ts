export const getCsrfToken = (): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
};

async function fetchWithTimeout(resource: RequestInfo, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
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

export const csrfFetch = (resource: RequestInfo, init: RequestInit = { method: 'GET' }): Promise<Response> => {
  init.credentials = init.credentials || 'same-origin';
  const csrf = getCsrfToken();
  if (csrf !== null) {
    init.headers = {
      ...init.headers,
      'CSRF-Token': csrf,
    };
  }
  return fetchWithTimeout(resource, init);
};

export const postJson = (resource: RequestInfo, body: any): Promise<Response> => {
  return csrfFetch(resource, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const callApi = async (route: RequestInfo, body: any): Promise<Response> => {
  return csrfFetch(route, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
