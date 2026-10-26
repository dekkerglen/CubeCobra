import { getFeaturedCubes } from 'serverutils/featuredQueue';
import { redirect, render } from 'serverutils/render';

import { Request, Response } from '../../types/express';

const landingHandler = async (req: Request, res: Response) => {
  // If user is logged in, redirect to dashboard
  if (req.user) {
    return redirect(req, res, '/dashboard');
  }

  const featured = await getFeaturedCubes(8);

  // No title on purpose: this is the site's front door, so it renders as the bare
  // "Cube Cobra" rather than "Something - Cube Cobra". Every other page sets one.
  return render(req, res, 'LandingPage', {
    featured,
  });
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [landingHandler],
  },
];
