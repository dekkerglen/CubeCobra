import { Router } from 'express';

import router from '../../src/router/router';
import { expectRegisteredRoutes } from '../test-utils/route';

/*
 * These routes change state, so they must not answer GET: a GET can be fired by an <img src> in
 * user Markdown (same-origin, so SameSite cookies don't help) or by a cross-site top-level link,
 * and the CSRF guard only inspects non-GET requests. Each one is registered as POST instead.
 */
const STATE_CHANGING_ROUTES = [
  '/user/logout/',
  '/user/follow/:id',
  '/user/unfollow/:id',
  '/user/report/:id',
  '/cube/report/:id',
  '/cube/:id/defaultdraftformat/:formatId',
  '/cube/feature/:id',
  '/cube/unfeature/:id',
  '/cube/blog/remove/:id',
  '/cube/format/remove/:cubeid/:index',
  '/cube/clone/:id',
  '/packages/upvote/:id',
  '/packages/downvote/:id',
  '/packages/remove/:id',
  '/content/newarticle',
  '/content/newpodcast',
  '/content/newvideo',
  '/content/podcast/update/:id',
  '/admin/banuser/:id',
  '/admin/publish/:id',
  '/admin/removereview/:id',
  '/admin/ignorereport/:id',
  '/admin/removecomment/:id',
  '/admin/featuredcubes/rotate/',
  '/admin/application/decline/:id',
  '/admin/application/approve/:id',
  '/draft/redraft/:id',
  '/cube/deck/rebuild/:id/:index',
];

const registeredMethods = (path: string): string[] =>
  (router as Router & { stack: any }).stack
    .filter((layer: any) => layer.route?.path === path)
    .flatMap((layer: any) => Object.keys(layer.route.methods));

describe('State-changing routes', () => {
  it.each(STATE_CHANGING_ROUTES)('registers %s as POST', (path) => {
    expectRegisteredRoutes([{ method: 'post', path }]);
  });

  it.each(STATE_CHANGING_ROUTES)('does not register %s as GET', (path) => {
    expect(registeredMethods(path)).not.toContain('get');
  });
});
