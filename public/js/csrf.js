// FIXME: Deduplicate with file in src/util.

window.getCsrfToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
};

window.csrfFetch = (resource, init) => {
  init.credentials = init.credentials || 'same-origin';
  init.headers = Object.assign(init.headers || {}, {
    'CSRF-Token': window.getCsrfToken(),
  });
  return fetch(resource, init);
};
