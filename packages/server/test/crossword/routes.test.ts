import { expectRegisteredRoutes } from '../test-utils/route';

describe('Crossword routes', () => {
  it('registers the page and API routes', () => {
    expectRegisteredRoutes([
      { path: '/tool/crossword/', method: 'get' },
      { path: '/tool/crossword/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', method: 'get' },
      { path: '/tool/crossword/archive/', method: 'get' },
      { path: '/tool/api/crossword/active/', method: 'get' },
      { path: '/tool/api/crossword/history/', method: 'get' },
      { path: '/tool/api/crossword/me/', method: 'get' },
      { path: '/tool/api/crossword/rotate/', method: 'post' },
      { path: '/tool/api/crossword/check/', method: 'post' },
      { path: '/tool/api/crossword/submit/', method: 'post' },
      { path: '/tool/api/crossword/reveal/', method: 'post' },
      { path: '/crossword/', method: 'get' },
      { path: '/crossword/archive', method: 'get' },
    ]);
  });
});
