import { Request, Response } from '../../../types/express';

// The Filter Syntax guide moved into the wiki. Permanently redirect the old URL so external links
// and bookmarks keep working.
const filtersHandler = (req: Request, res: Response) => {
  return res.redirect(301, '/wiki/reference/filter-syntax');
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [filtersHandler],
  },
];
