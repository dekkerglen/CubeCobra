import { Request, Response } from '../../../types/express';

// The Markdown guide moved into the wiki. Permanently redirect the old URL so external links and
// bookmarks keep working.
const markdownHandler = (req: Request, res: Response) => {
  return res.redirect(301, '/wiki/reference/markdown');
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [markdownHandler],
  },
];
