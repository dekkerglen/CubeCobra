import { blogDao, cubeDao } from 'dynamo/daos';
import RSS from 'rss';
import { changelogToText } from 'serverutils/blog';
import { isCubeViewable } from 'serverutils/cubefn';
import { handleRouteError, redirect } from 'serverutils/render';
import { getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

export const rssHandler = async (req: Request, res: Response) => {
  try {
    const split = req.params.id!.split(';');
    const cubeID = split[0];
    if (!cubeID) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(cubeID);
    if (!isCubeViewable(cube, req.user) || !cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found`);
      return redirect(req, res, '/404');
    }

    const items = [];
    let lastKey = undefined;

    do {
      const queryResult = await blogDao.queryByCube(cube.id, lastKey, 128);
      items.push(...queryResult.items);
      lastKey = queryResult.lastKey;
    } while (lastKey);

    const baseUrl = getBaseUrl();
    const feed = new RSS({
      title: cube.name,
      feed_url: `${baseUrl}/cube/rss/${cube.id}`,
      site_url: baseUrl,
    });

    items.forEach((blog: any) => {
      if (blog.body && blog.Changelog) {
        feed.item({
          title: blog.title,
          url: `${baseUrl}/cube/blog/blogpost/${blog.id}`,
          description: `${blog.body}\n\n${changelogToText(blog.Changelog)}`,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.body) {
        feed.item({
          title: blog.title,
          url: `${baseUrl}/cube/blog/blogpost/${blog.id}`,
          description: blog.body,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.Changelog) {
        feed.item({
          title: blog.title,
          url: `${baseUrl}/cube/blog/blogpost/${blog.id}`,
          description: changelogToText(blog.Changelog),
          guid: blog.id,
          date: blog.date,
        });
      }
    });
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(feed.xml());
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [rssHandler],
  },
];
