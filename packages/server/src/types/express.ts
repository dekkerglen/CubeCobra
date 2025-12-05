import type UserType from '@utils/datatypes/User';
import express from 'express';

// Extend Error interface to include status property
export interface CustomError extends Error {
  status?: number;
}

// Override the user type in the global Express namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends UserType {}
    interface Request {
      user?: User;
      uuid: string;
      logger: {
        error: (...args: any[]) => void;
      };
      flash: {
        (): { [key: string]: string[] };
        (message: string): string[];
        (type: string, message: string | string[]): number;
        (type: string, format: string, ...args: any[]): number;
      };
      validated?: boolean;
      isAuthenticated(): boolean;
      csrfToken(): string;
    }
  }
}

// Export types for use in other files
export interface Request extends Omit<express.Request, 'isAuthenticated' | 'flash'> {
  user?: Express.User;
  uuid: string;
  logger: {
    error: (...args: any[]) => void;
  };
  flash: {
    (): { [key: string]: string[] };
    (message: string): string[];
    (type: string, message: string | string[]): number;
    (type: string, format: string, ...args: any[]): number;
  };
  validated?: boolean;
  isAuthenticated(): boolean;
  csrfToken(): string;
}

export interface Response extends express.Response {}

export interface NextFunction extends express.NextFunction {}

export interface RequestHandler extends express.RequestHandler {
  (req: Request, res: Response, next: NextFunction): void;
}
