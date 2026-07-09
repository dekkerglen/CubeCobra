import { UserRoles } from '@utils/datatypes/User';
import { patronDao, userDao } from 'dynamo/daos';
import { csrfProtection, ensureRole } from 'router/middleware';
import { handleRouteError, render } from 'serverutils/render';
import { Request, Response } from 'types/express';

const PAGE_SIZE = 48;

// A patron row enriched with the linked user's username for display and profile linking.
export interface AdminPatronRow {
  owner: string;
  username: string | null;
  email: string;
  level: number;
  status: string;
}

// Resolves a page of patrons into display rows, batch-fetching the linked users so we can
// show a username and link to /user/view/{owner}.
const toRows = async (
  patrons: { owner: string; email: string; level: number; status: string }[],
): Promise<AdminPatronRow[]> => {
  const owners = patrons.map((p) => p.owner).filter(Boolean);
  const users = owners.length > 0 ? await userDao.batchGet(owners) : [];
  const usernameById = new Map(users.map((u) => [u.id, u.username]));

  return patrons.map((p) => ({
    owner: p.owner,
    username: usernameById.get(p.owner) ?? null,
    email: p.email,
    level: p.level,
    status: p.status,
  }));
};

export const patronsHandler = async (req: Request, res: Response) => {
  try {
    const { items, lastKey } = await patronDao.getAllPatrons(undefined, PAGE_SIZE);
    const patrons = await toRows(items);

    return render(req, res, 'AdminPatronsPage', {
      patrons,
      lastKey: lastKey ?? null,
    });
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const getMorePatronsHandler = async (req: Request, res: Response) => {
  try {
    const { lastKey } = req.body;
    const result = await patronDao.getAllPatrons(lastKey || undefined, PAGE_SIZE);
    const patrons = await toRows(result.items);

    return res.status(200).send({
      success: 'true',
      patrons,
      lastKey: result.lastKey ?? null,
    });
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), patronsHandler],
  },
  {
    method: 'post',
    path: '/getmore',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), getMorePatronsHandler],
  },
];
