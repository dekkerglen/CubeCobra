import { expectRegisteredRoutes } from '../test-utils/route';

describe('ManaMatrix routes', () => {
  it('registers the page and API routes', () => {
    expectRegisteredRoutes([
      { path: '/tool/manamatrix/', method: 'get' },
      { path: '/tool/manamatrix/:date', method: 'get' },
      { path: '/tool/manamatrix/archive/', method: 'get' },
      { path: '/tool/api/manamatrix/active/', method: 'get' },
      { path: '/tool/api/manamatrix/puzzle/:date', method: 'get' },
      { path: '/tool/api/manamatrix/history/', method: 'get' },
      { path: '/tool/api/manamatrix/me/', method: 'get' },
      { path: '/tool/api/manamatrix/rotate/', method: 'post' },
      { path: '/tool/api/manamatrix/submit/', method: 'post' },
      { path: '/tool/api/manamatrix/analysis/:date', method: 'get' },
      { path: '/manamatrix/', method: 'get' },
      { path: '/manamatrix/archive', method: 'get' },
      { path: '/manamatrix/:date', method: 'get' },
    ]);
  });
});
