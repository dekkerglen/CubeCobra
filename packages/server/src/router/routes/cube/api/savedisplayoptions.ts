import { CUBE_DISPLAY_OPTION_KEYS } from '@utils/datatypes/Cube';
import { cubeDao } from 'dynamo/daos';
import Joi from 'joi';
import { bodyValidation, ensureAuthJson } from 'router/middleware';
import { isCubeEditable, isCubeViewable } from 'serverutils/cubefn';

import { Request, Response } from '../../../../types/express';

export const DisplayOptionsSchema = Joi.object({
  displayOptions: Joi.object(
    Object.fromEntries(CUBE_DISPLAY_OPTION_KEYS.map((key) => [key, Joi.boolean().strict().required()])),
  )
    .unknown(true)
    .required(),
});

export const savedisplayoptionsHandler = async (req: Request, res: Response) => {
  try {
    const cube = await cubeDao.getById(req.params.id!);

    if (!cube || !isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!isCubeEditable(cube, req.user)) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    for (const key of CUBE_DISPLAY_OPTION_KEYS) {
      cube[key] = req.body.displayOptions[key];
    }
    // Display defaults aren't a content edit: keep the cube's date, which also leaves its search rows untouched.
    await cubeDao.update(cube, { skipTimestampUpdate: true });

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).send({
      success: 'false',
      message: 'Error saving display options',
    });
  }
};

export const routes = [
  {
    method: 'post',
    path: '/:id',
    handler: [ensureAuthJson, bodyValidation(DisplayOptionsSchema), savedisplayoptionsHandler],
  },
];
