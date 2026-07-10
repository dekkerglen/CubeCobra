import { redirect, render } from 'serverutils/render';
import { getWikiPage, getWikiTree, searchWiki } from 'serverutils/wiki';

import { Request, Response } from '../../types/express';

// GET /wiki — the wiki landing page, or search results when a `q` query is present.
const wikiIndexHandler = async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  if (query.trim()) {
    return render(
      req,
      res,
      'WikiPage',
      { tree: getWikiTree(), page: null, activeSlug: null, search: { query, results: searchWiki(query) } },
      { title: `Search: ${query} - Wiki`, noindex: true },
    );
  }
  return render(
    req,
    res,
    'WikiPage',
    { tree: getWikiTree(), page: null, activeSlug: null, search: null },
    { title: 'Wiki' },
  );
};

// GET /wiki/<any/nested/slug> — render the article at that slug, or 404 if it doesn't exist.
const wikiPageHandler = async (req: Request, res: Response) => {
  const raw = (req.params[0] ?? '').replace(/\/+$/, '');
  // "/wiki/" (empty capture) belongs on the landing page, not a 404.
  if (raw === '') {
    return redirect(req, res, '/wiki');
  }
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    slug = raw;
  }

  const page = getWikiPage(slug);
  if (!page) {
    return redirect(req, res, '/404');
  }

  return render(
    req,
    res,
    'WikiPage',
    { tree: getWikiTree(), page, activeSlug: slug },
    {
      title: `${page.title} - Wiki`,
      metadata: page.description
        ? [{ property: 'og:description', content: page.description }]
        : undefined,
    },
  );
};

export const routes = [
  {
    path: '',
    method: 'get',
    handler: [wikiIndexHandler],
  },
  {
    path: '/*',
    method: 'get',
    handler: [wikiPageHandler],
  },
];
