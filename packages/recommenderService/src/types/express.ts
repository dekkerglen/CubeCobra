import { Request as ExpressRequest, Response as ExpressResponse } from 'express';

export interface Request extends ExpressRequest {
  uuid?: string;
  logger: {
    info: (message: string, meta?: string) => void;
    error: (message: string, meta?: string) => void;
  };
}

export interface Response extends ExpressResponse {}

export interface CustomError extends Error {
  status?: number;
}
