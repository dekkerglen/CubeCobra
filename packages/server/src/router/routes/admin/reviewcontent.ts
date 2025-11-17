import { ContentStatus } from '@utils/datatypes/Content';
import { UserRoles } from '@utils/datatypes/User';
import Content from 'dynamo/models/content';
import { csrfProtection, ensureRole } from 'routes/middleware';
import { render } from 'serverutils/render';
import { Request, Response } from 'types/express';

export const reviewcontentHandler = async (req: Request, res: Response) => {
  const content = await Content.getByStatus(ContentStatus.IN_REVIEW);
  return render(req, res, 'ReviewContentPage', { content: content.items });
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, ensureRole(UserRoles.ADMIN), reviewcontentHandler],
  },
];
