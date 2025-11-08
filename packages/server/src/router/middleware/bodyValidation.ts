import Joi from 'joi';

import { NextFunction, Request, Response } from '../../types/express';
import { redirect } from '../../util/render';

export const bodyValidation =
  (schema: Joi.Schema<any>, redirectUrlFn?: (req: Request) => string, path?: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const { error } = path ? schema.validate(JSON.parse(req.body[path])) : schema.validate(req.body);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Validation error:', error);

      if (redirectUrlFn) {
        req.flash('danger', error.details[0]?.message || 'Validation error');
        return redirect(req, res, redirectUrlFn(req));
      }

      return res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    }
    next();
  };
