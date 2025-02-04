import { Router } from 'express';

import router from '../../src/router/router';

export const expectRegisteredRoutes = (routes: { method: string; path: string }[]) => {
  const registeredRoutes = (router as Router & { stack: any }).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
    }));

  routes.forEach((route) => {
    expect(registeredRoutes).toContainEqual(route);
  });
};
