import { expectRegisteredRoutes } from '../test-utils/route';

describe('Synergy Connect routes', () => {
  it('registers the page and API routes', () => {
    expectRegisteredRoutes([
      { path: '/tool/synergyconnect/', method: 'get' },
      { path: '/tool/synergyconnect/:date([0-9]{4}-[0-9]{2}-[0-9]{2})', method: 'get' },
      { path: '/tool/synergyconnect/archive/', method: 'get' },
      { path: '/tool/api/synergyconnect/active/', method: 'get' },
      { path: '/tool/api/synergyconnect/history/', method: 'get' },
      { path: '/tool/api/synergyconnect/me/', method: 'get' },
      { path: '/tool/api/synergyconnect/rotate/', method: 'post' },
      { path: '/tool/api/synergyconnect/guess/', method: 'post' },
      { path: '/synergyconnect/', method: 'get' },
      { path: '/synergyconnect/archive', method: 'get' },
    ]);
  });
});
