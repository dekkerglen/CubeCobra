import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import clientErrors, { ClientErrorReport } from 'serverutils/clientErrors';
import { userOrIpKey } from 'serverutils/rateLimitKeys';

import { NextFunction, Request, Response } from '../../../types/express';

// A single browser-reported error. Every field is length-bounded so a malicious or
// runaway client can't push oversized payloads into our log buffer.
const ReportSchema = Joi.object({
  message: Joi.string().max(4000).required(),
  kind: Joi.string().valid('onerror', 'unhandledrejection', 'react-boundary').required(),
  stack: Joi.string().max(16000).allow('').optional(),
  componentStack: Joi.string().max(16000).allow('').optional(),
  source: Joi.string().max(2000).allow('').optional(),
  lineno: Joi.number().optional(),
  colno: Joi.number().optional(),
  url: Joi.string().max(2000).allow('').optional(),
  userAgent: Joi.string().max(1000).allow('').optional(),
  clientTimestamp: Joi.number().optional(),
});

const BodySchema = Joi.object({
  errors: Joi.array().items(ReportSchema).min(1).max(20).required(),
});

// Aggressive limit: a single page shouldn't need to report often, and the client
// already batches and caps itself. Keyed by user id (or IP when logged out).
const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  message: '429: Too Many Requests',
});

const validateBody = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = BodySchema.validate(req.body, { stripUnknown: true });
  if (error) {
    res.status(400).json({ error: error.details[0]?.message || 'Validation error' });
    return;
  }
  next();
};

const handler = async (req: Request, res: Response) => {
  try {
    const { errors } = req.body as { errors: ClientErrorReport[] };

    for (const entry of errors) {
      clientErrors.report({
        ...entry,
        // Server-enriched context — never trusted from the client.
        requestId: req.uuid,
        userId: req.user ? req.user.id : null,
        username: req.user ? req.user.username : null,
        remoteAddr: req.ip,
        version: process.env.CUBECOBRA_VERSION,
        receivedAt: new Date().toISOString(),
      });
    }

    return res.status(204).send();
  } catch (error) {
    // Reporting must never itself 500 in a way the client would notice/retry-storm on.
    console.error('Error handling client error report', error);
    return res.status(204).send();
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [clientErrorLimiter, validateBody, handler],
  },
];
