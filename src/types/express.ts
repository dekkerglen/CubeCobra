import express from 'express';
import User from 'src/datatypes/User';

export interface Request extends express.Request {
  user?: User;
  flash: (type: string, message: string) => void;
  logger: {
    error: (...args: any[]) => void;
  };
  csrfToken: () => string;
}

export interface Response extends express.Response {}

export interface NextFunction extends express.NextFunction {}

export interface RequestHandler extends express.RequestHandler {
  (req: Request, res: Response, next: NextFunction): void;
}
