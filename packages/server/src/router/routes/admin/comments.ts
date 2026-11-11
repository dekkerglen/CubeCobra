// Load Environment Variables
import { UserRoles } from '@utils/datatypes/User';
import { csrfProtection, ensureRole } from 'router/middleware';
import { adminTabUrl } from 'serverutils/adminDashboard';
import { redirect } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const comments = async (req: Request, res: Response) => {
  return redirect(req, res, adminTabUrl('notices'));
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), comments],
  },
];
