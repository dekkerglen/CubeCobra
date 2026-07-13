import { FeaturedQueueItem } from '@utils/datatypes/FeaturedQueue';
import { UserRoles } from '@utils/datatypes/User';
import { featuredQueueDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const moveHandler = async (req: Request, res: Response) => {
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, '/admin/featuredcubes');
  }

  const position = parseInt(req.body.position, 10);
  if (!Number.isInteger(position)) {
    req.flash('danger', 'Invalid position');
    return redirect(req, res, '/admin/featuredcubes');
  }

  // Fetch the entire queue, sorted ascending by date (same ordering the page shows).
  let queue: FeaturedQueueItem[] = [];
  let lastkey: Record<string, any> | null | undefined = null;
  do {
    const response = await featuredQueueDao.querySortedByDate(lastkey || undefined);
    queue = queue.concat(response.items || []);
    lastkey = response.lastKey;
  } while (lastkey);

  const moving = queue.find((item) => item.cube === req.body.cubeId);
  if (!moving) {
    req.flash('danger', 'Cube not found in featured queue');
    return redirect(req, res, '/admin/featuredcubes');
  }

  // Positions are 1-indexed to match the queue display. The cube is placed between
  // the cube currently at `position` and the one at `position - 1`. The first two
  // positions are the live featured cubes, so they stay fixed.
  const targetIndex = position - 1;
  if (targetIndex < 2 || targetIndex > queue.length - 1) {
    req.flash('danger', `Position must be between 3 and ${queue.length}`);
    return redirect(req, res, '/admin/featuredcubes');
  }

  const before = queue[targetIndex - 1];
  const after = queue[targetIndex];
  if (!before || !after) {
    req.flash('danger', 'Invalid position');
    return redirect(req, res, '/admin/featuredcubes');
  }

  // Midpoint keeps the moved cube strictly between its new neighbors without
  // disturbing any other cube's date.
  moving.date = (before.date + after.date) / 2;
  await featuredQueueDao.update(moving);

  return redirect(req, res, '/admin/featuredcubes');
};

export const routes = [
  {
    method: 'post',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), moveHandler],
  },
];
