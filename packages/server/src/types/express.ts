import express from 'express';
import type UserType from '@utils/datatypes/User';

// Extend Error interface to include status property
export interface CustomError extends Error {
  status?: number;
}

// Override the user type in the global Express namespace
declare global {
  namespace Express {
    interface User extends UserType {}
    interface Request {
      user?: User;
      uuid: string;
      logger: {
        error: (...args: any[]) => void;
      };
      flash(type: string, message: string): void;
      validated?: boolean;
      isAuthenticated(): boolean;
      csrfToken(): string;
    }
  }
}

// Export types for use in other files
export interface Request extends Omit<express.Request, 'isAuthenticated'> {
  user?: Express.User;
  uuid: string;
  logger: {
    error: (...args: any[]) => void;
  };
  flash(type: string, message: string): void;
  validated?: boolean;
  isAuthenticated(): boolean;
  csrfToken(): string;
}

export interface Response extends express.Response {}

export interface NextFunction extends express.NextFunction {}

export interface RequestHandler extends express.RequestHandler {
  (req: Request, res: Response, next: NextFunction): void;
}
