import Joi from 'joi';

import { makeFilter } from '../../../../client/filtering/FilterCards';
import { SortDirections, SortDirectionsType } from '../../../../client/hooks/UseSortableData';
import { OrderedSortsType, SortFunctions } from '../../../../client/utils/Sort';
import { csrfProtection } from '../../../../routes/middleware';
import { NextFunction, Request, Response } from '../../../../types/express';
import { searchCards } from '../../../../util/tools';

const validSortNames = Object.keys(SortFunctions);

const TopCardsQuerySchema = Joi.object({
  f: Joi.string().empty('').optional(),
  s: Joi.string()
    .valid(...validSortNames)
    .required(),
  d: Joi.string()
    .valid(...SortDirections)
    .required(),
  p: Joi.number().integer().min(0).required(),
}).unknown(true); // allow additional fields

const validateQuery = (req: Request, res: Response, next: NextFunction) => {
  const { error } = TopCardsQuerySchema.validate(req.query);
  if (error) {
    res.status(400).json({ error: error.details[0].message });
    return;
  }
  next();
};

export const getTopCardsPage = async (req: Request, res: Response) => {
  try {
    const { err, filter } = makeFilter(`${req.query.f}`);
    if (err) {
      res.status(400).send({
        success: 'false',
        numResults: 0,
        data: [],
      });
      return;
    }

    const { data, numResults } = searchCards(
      filter!, //On error the filter is null, which is handled
      req.query.s as OrderedSortsType,
      parseInt(req.query.p as string, 10),
      req.query.d as SortDirectionsType,
      'names',
      req?.user?.defaultPrinting,
    );
    res.status(200).send({
      success: 'true',
      data,
      numResults,
    });
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    res.status(500).send({
      success: 'false',
      numResults: 0,
      data: [],
    });
  }
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [csrfProtection, validateQuery, getTopCardsPage],
  },
];
