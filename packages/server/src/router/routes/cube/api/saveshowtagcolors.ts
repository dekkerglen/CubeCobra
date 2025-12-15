import { userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { ensureAuth, jsonValidationErrors } from 'router/middleware';

import { Request, Response } from '../../../../types/express';

export const saveshowtagcolorsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).send({
        success: 'false',
        message: 'User not authenticated',
      });
    }

    const user = await userDao.getById(req.user.id);

    if (!user) {
      return res.status(404).send({
        success: 'false',
        message: 'User not found',
      });
    }

    user.hideTagColors = !req.body.show_tag_colors;

    await userDao.update(user);
    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error saving tag color preference',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '',
    handler: [ensureAuth, body('show_tag_colors').toBoolean(), jsonValidationErrors, saveshowtagcolorsHandler],
  },
];
