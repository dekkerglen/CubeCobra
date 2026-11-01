import { makeFilter, MAX_SEARCH_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import { OrderedSortsType, SortFunctions } from '@utils/sorting/Sort';
import { SortDirections, SortDirectionsType } from '@utils/sorting/sortContext';
import Joi from 'joi';
import { expensiveGetLimiter } from 'serverutils/rateLimiters';
import { searchCards } from 'serverutils/tools';
import { applyUniversesBeyondSetting } from 'serverutils/universesBeyond';

import { NextFunction, Request, Response } from '../../../../types/express';

const validSortNames = Object.keys(SortFunctions);

const TopCardsQuerySchema = Joi.object({
  f: Joi.string().allow('').max(MAX_SEARCH_FILTER_LENGTH).required(),
  s: Joi.string()
    .valid(...validSortNames)
    .required(),
  d: Joi.string()
    .valid(...SortDirections)
    .required(),
  p: Joi.number().integer().min(0).required(),
}).unknown(true); // allow additional fields

export const validateQuery = (req: Request, res: Response, next: NextFunction) => {
  const { error } = TopCardsQuerySchema.validate(req.query);
  if (error) {
    res.status(400).json({ error: error.details?.[0]?.message || 'Validation error' });
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
      applyUniversesBeyondSetting(filter, req.user, req.query.f)!, //On error the filter is null, which is handled
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
    handler: [expensiveGetLimiter(60_000, 120), validateQuery, getTopCardsPage],
  },
];
